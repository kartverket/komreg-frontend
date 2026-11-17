import { fraReformSpec, tilReformSpec } from "@/domain/reformSpec";
import type {
  OpprettReguleringRequest,
  ReguleringDetail,
  ReguleringSummary,
} from "@/domain/regulering";
import type { ReformSpec } from "@/types/ReformSpec";

export async function createRegulering(request: OpprettReguleringRequest): Promise<number> {
  const reformSpec = tilReformSpec(request);

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

export async function updateRegulering(
  id: number,
  request: OpprettReguleringRequest,
): Promise<void> {
  const reformSpec = tilReformSpec(request);
  let res: Response;
  try {
    res = await fetch(new URL(`/api/regulering/api/reguleringer/${id}`, window.location.origin), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reformSpec),
    });
  } catch {
    throw new Error("Reguleringen kunne ikke lagres på serveren");
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error("Fant ikke reguleringen");
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
  let res: Response;
  try {
    res = await fetch(new URL(`/api/regulering/api/reguleringer/${id}`, window.location.origin));
  } catch {
    throw new Error("Reguleringen kunne ikke hentes fra serveren");
  }
  if (res.status === 404) throw new Error("Fant ikke reguleringen");
  if (!res.ok) throw new Error("Reguleringen kunne ikke hentes fra serveren");
  const data = (await res.json()) as ReformSpec;
  return fraReformSpec(id, data);
}
