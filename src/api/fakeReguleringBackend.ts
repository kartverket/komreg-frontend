import { vi } from "vite-plus/test";
import type { OpprettReguleringRequest, ReguleringDetail } from "@/domain/regulering";
import { REGULERINGER_URL } from "./reguleringer";

type Fetch = (url: string, init?: RequestInit) => Promise<unknown>;

// Testdobbel for reguleringsbackenden: reguleringer i minnet, en SSE-strøm (falsk EventSource) og
// POST via fetch. Kall i testen, før fetch brukes; andre kall går videre til `andreKall`.
export function stubReguleringBackend(
  andreKall: Fetch = () => Promise.reject(new Error("Ukjent kall")),
) {
  const kilder = new Set<FakeEventSource>();

  const backend = {
    reguleringer: [] as ReguleringDetail[],
    lagringFeiler: false,
    strommenFeiler: false,
    // Simulerer at upsert-eventet ikke har kommet fram ennå.
    upsertsUteblir: false,
    opprett: (request: OpprettReguleringRequest): ReguleringDetail => {
      const regulering = { id: backend.reguleringer.length + 1, ...request };
      backend.reguleringer.push(regulering);
      if (!backend.upsertsUteblir) for (const kilde of kilder) kilde.send("upsert", regulering);
      return regulering;
    },
  };

  const fetchStub: Fetch = (url, init) => {
    if (url !== REGULERINGER_URL || init?.method !== "POST") return andreKall(url, init);
    if (backend.lagringFeiler) return Promise.resolve(new Response(null, { status: 500 }));
    const request = JSON.parse(init.body as string) as OpprettReguleringRequest;
    return Promise.resolve(new Response(JSON.stringify(backend.opprett(request)), { status: 201 }));
  };

  class FakeEventSource extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readyState: number = FakeEventSource.CONNECTING;
    readonly url: string;

    constructor(url: string) {
      super();
      this.url = url;
      kilder.add(this);
      queueMicrotask(() => {
        if (this.readyState === FakeEventSource.CLOSED) return;
        if (backend.strommenFeiler) {
          this.close();
          this.dispatchEvent(new Event("error"));
          return;
        }
        this.readyState = FakeEventSource.OPEN;
        this.send("snapshot", backend.reguleringer);
      });
    }

    send(type: string, data: unknown) {
      this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
    }

    close() {
      this.readyState = FakeEventSource.CLOSED;
      kilder.delete(this);
    }
  }

  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", fetchStub);
  return backend;
}
