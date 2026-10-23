import type {
  OpprettReguleringRequest,
  ReguleringDetail,
  ReguleringSummary,
} from "@/domain/regulering";

export const REGULERINGER_STORAGE_KEY = "komreg:reguleringer:v1";

// TODO: Dette må byttes ut når regulerings apiet er klart.
// Viba opp en localstorage "mock" inntil videre, 
// skal bare være å bytte ut dette direkte uten å måtte røre noe annet

function read(): ReguleringDetail[] {
  const stored = localStorage.getItem(REGULERINGER_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as ReguleringDetail[];
  } catch {
    throw new Error("Lokalt lagrede reguleringer kunne ikke leses");
  }
}

export async function createRegulering(
  request: OpprettReguleringRequest,
): Promise<number> {
  const reguleringer = read();
  const id = Math.max(0, ...reguleringer.map((item) => item.id)) + 1;

  try {
    localStorage.setItem(
      REGULERINGER_STORAGE_KEY,
      JSON.stringify([...reguleringer, { id, ...request }]),
    );
  } catch {
    throw new Error("Reguleringen kunne ikke lagres lokalt");
  }
  return id;
}

export async function listReguleringer(): Promise<ReguleringSummary[]> {
  const stored = localStorage.getItem(REGULERINGER_STORAGE_KEY);
  if (!stored) return [];
  try {
    return (JSON.parse(stored) as ReguleringDetail[]).map(
      ({ id, navn, dato, grensejustering }) => ({
        id,
        navn,
        dato,
        fraKommunenummer: grensejustering.fraKommunenummer,
        tilKommunenummer: grensejustering.tilKommunenummer,
        antallMatrikkelenheter: grensejustering.matrikkelenheter.length,
      }),
    );
  } catch {
    throw new Error("Lokalt lagrede reguleringer kunne ikke leses");
  }
}

export async function getRegulering(id: number): Promise<ReguleringDetail> {
  const regulering = read().find((item) => item.id === id);
  if (!regulering) throw new Error("Fant ikke reguleringen");
  return regulering;
}
