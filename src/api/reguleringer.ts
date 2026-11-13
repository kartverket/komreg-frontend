import { fraReformSpec, tilReformSpec } from "@/domain/reformSpec";
import type {
  OpprettReguleringRequest,
  ReguleringDetail,
  ReguleringSummary,
} from "@/domain/regulering";
import type { ReformSpec } from "@/types/ReformSpec";

export const REGULERINGER_STORAGE_KEY = "komreg:reguleringer:v1";

export async function createRegulering(request: OpprettReguleringRequest): Promise<number> {
  const reformSpec = tilReformSpec(request);
  //const id = Math.max(0, ...reguleringer.map((item) => item.id)) + 1;

  try {
    const res = await fetch(new URL("/api/regulering/api/reguleringer", window.location.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reformSpec),
    });
    if (!res.ok) throw new Error("Reguleringen kunne ikke lagres på serveren");
    const { id } = (await res.json()) as { id: number };
    return id;
  } catch {
    throw new Error("Reguleringen kunne ikke lagres på serveren");
  }
}

export async function listReguleringer(): Promise<ReguleringSummary[]> {
  try {
    const res = await fetch(new URL("/api/regulering/api/reguleringer", window.location.origin));
    if (!res.ok) throw new Error("Reguleringer kunne ikke hentes fra serveren");
    const data = (await res.json()) as { id: number; navn: string; ikrafttredelse: string }[];

    return data.map(({ id, navn, ikrafttredelse }) => ({
      id,
      navn,
      dato: ikrafttredelse,
      fraKommunenummer: "", // Placeholder, replace with actual value if available
      tilKommunenummer: "", // Placeholder, replace with actual value if available
    }));
  } catch {
    throw new Error("Reguleringer kunne ikke hentes fra serveren");
  }
}

export async function getRegulering(id: number): Promise<ReguleringDetail> {
  try {
    const res = await fetch(
      new URL(`/api/regulering/api/reguleringer/${id}`, window.location.origin),
    );
    if (!res.ok) throw new Error("Fant ikke reguleringen");
    const data = (await res.json()) as ReformSpec;
    return fraReformSpec(id, data);
  } catch {
    throw new Error("Reguleringen kunne ikke hentes fra serveren");
  }
}
