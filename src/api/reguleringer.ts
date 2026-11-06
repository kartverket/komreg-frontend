import type {
  OpprettReguleringRequest,
  ReguleringDetail,
  ReguleringSummary,
} from "@/domain/regulering";

export const REGULERINGER_URL = "/api/reguleringer";
const REGULERINGER_STREAM_URL = `${REGULERINGER_URL}/stream`;

// Cache av serverens reguleringer. Serveren er fasit: "snapshot" (alle) ved hver (re)tilkobling
// erstatter cachen, deretter "upsert" med hele reguleringen per endring.
const reguleringer = new Map<number, ReguleringDetail>();
let source: EventSource | null = null;
let ready: Promise<void> | null = null;

function connect(): Promise<void> {
  ready ??= new Promise<void>((resolve, reject) => {
    const eventSource = new EventSource(REGULERINGER_STREAM_URL);
    source = eventSource;
    let harSnapshot = false;

    eventSource.addEventListener("snapshot", (event) => {
      reguleringer.clear();
      for (const regulering of JSON.parse(event.data as string) as ReguleringDetail[]) {
        reguleringer.set(regulering.id, regulering);
      }
      harSnapshot = true;
      resolve();
    });
    eventSource.addEventListener("upsert", (event) => {
      const regulering = JSON.parse(event.data as string) as ReguleringDetail;
      reguleringer.set(regulering.id, regulering);
    });
    eventSource.addEventListener("error", () => {
      // Etter første snapshot reconnecter EventSource selv og får et nytt snapshot.
      // Uten noe snapshot gir vi opp, slik at neste kall prøver på nytt i stedet for å henge.
      if (harSnapshot && eventSource.readyState !== EventSource.CLOSED) return;
      disconnectReguleringer();
      reject(new Error("Kunne ikke hente reguleringer"));
    });
  });
  return ready;
}

export function disconnectReguleringer() {
  source?.close();
  source = null;
  ready = null;
  reguleringer.clear();
}

export async function createRegulering(request: OpprettReguleringRequest): Promise<number> {
  let response: Response;
  try {
    response = await fetch(REGULERINGER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Reguleringen kunne ikke lagres");
  }
  if (!response.ok) throw new Error("Reguleringen kunne ikke lagres");
  // Serveren svarer med hele reguleringen. Den legges inn med en gang, så getRegulering(id)
  // rett etterpå ikke er avhengig av at upsert-eventet har kommet fram.
  const regulering = (await response.json()) as ReguleringDetail;
  reguleringer.set(regulering.id, regulering);
  return regulering.id;
}

export async function listReguleringer(): Promise<ReguleringSummary[]> {
  await connect();
  return [...reguleringer.values()].map(({ id, navn, dato, grensejustering }) => ({
    id,
    navn,
    dato,
    fraKommunenummer: grensejustering.fraKommunenummer,
    tilKommunenummer: grensejustering.tilKommunenummer,
  }));
}

export async function getRegulering(id: number): Promise<ReguleringDetail> {
  await connect();
  const regulering = reguleringer.get(id);
  if (!regulering) throw new Error("Fant ikke reguleringen");
  return regulering;
}
