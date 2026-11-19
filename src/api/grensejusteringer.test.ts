import { describe, expect, it, vi } from "vite-plus/test";
import { tilReformSpec } from "@/domain/reformSpec";
import type { OpprettGrensejusteringRequest } from "@/domain/grensejustering";
import {
  createGrensejustering,
  getGrensejustering,
  listGrensejusteringer,
  updateGrensejustering,
} from "./grensejusteringer";

const request: OpprettGrensejusteringRequest = {
  navn: "Grensejustering test",
  fraKommunenummer: "1525",
  tilKommunenummer: "1508",
  matrikkelenheter: [
    {
      kommunenummer: "1525",
      gardsnummer: 12,
      bruksnummer: 4,
      teigIder: [10, 11],
    },
  ],
  teiger: [{ kommunenummer: "1525", teigId: 12 }],
  vegadresser: [
    {
      kommunenummer: "1525",
      veg: { adressekode: 1234, adressenavn: "Storgata" },
      husnummer: { nummer: 5, bokstav: "A" },
      nyVeg: { adressekode: 5678, adressenavn: "Kirkevegen" },
      nyttHusnummer: { nummer: 7, bokstav: "" },
    },
  ],
};

function mockFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi
    .fn<(url: URL, init?: RequestInit) => Promise<Pick<Response, "ok" | "json" | "status">>>()
    .mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("grensejusteringer-API", () => {
  it("sender reformSpec og returnerer ID-en fra serveren", async () => {
    const fetchMock = mockFetch({ id: 7 });

    await expect(createGrensejustering(request)).resolves.toBe(7);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/regulering/api/reguleringer");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(tilReformSpec(request));
  });

  it("feiler når serveren ikke lagrer grensejusteringen", async () => {
    mockFetch({}, false);

    await expect(createGrensejustering(request)).rejects.toThrow("kunne ikke lagres");
  });

  it("lager sammendrag for grensejusteringslisten", async () => {
    mockFetch([{ id: 1, navn: "Test", ikrafttredelse: "2026-10-21" }]);

    await expect(listGrensejusteringer()).resolves.toEqual([
      { id: 1, navn: "Test", fraKommunenummer: "", tilKommunenummer: "" },
    ]);
  });

  it("sender den endrede reformSpec med PUT", async () => {
    const fetchMock = mockFetch({});

    await updateGrensejustering(7, request);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/regulering/api/reguleringer/7");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(tilReformSpec(request));
  });

  it("update feiler når serveren ikke lagrer endringen", async () => {
    mockFetch({}, false);

    await expect(updateGrensejustering(7, request)).rejects.toThrow("kunne ikke lagres");
  });

  it("update feiler når grensejusteringen som skal endres ikke finnes", async () => {
    mockFetch({}, false, 404);
    await expect(updateGrensejustering(12345, request)).rejects.toThrow(
      "Fant ikke grensejusteringen",
    );
  });

  it("update feiler med norsk melding når nettverket feiler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(updateGrensejustering(7, request)).rejects.toThrow(
      "Grensejusteringen kunne ikke lagres på serveren",
    );
  });

  it("get feiler når grensejusteringen ikke finnes", async () => {
    mockFetch({}, false, 404);
    await expect(getGrensejustering(404)).rejects.toThrow("Fant ikke grensejusteringen");
  });

  it("get feiler med norsk melding når serveren eller nettverket feiler", async () => {
    mockFetch({}, false);
    await expect(getGrensejustering(3)).rejects.toThrow("kunne ikke hentes");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getGrensejustering(3)).rejects.toThrow(
      "Grensejusteringen kunne ikke hentes fra serveren",
    );
  });
  it("henter en grensejustering og mapper den fra reformSpec", async () => {
    mockFetch(tilReformSpec(request));

    await expect(getGrensejustering(3)).resolves.toMatchObject({
      id: 3,
      navn: request.navn,
    });
  });
});
