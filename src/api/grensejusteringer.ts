import { fraReformSpec, tilReformSpec } from "@/domain/reformSpec";
import type {
  OpprettGrensejusteringRequest,
  GrensejusteringDetail,
  GrensejusteringSummary,
} from "@/domain/grensejustering";
import type { ReformSpec } from "@/types/ReformSpec";

export async function createGrensejustering(
  request: OpprettGrensejusteringRequest,
): Promise<number> {
  const reformSpec = tilReformSpec(request);

  try {
    const res = await fetch(new URL("/api/regulering/api/reguleringer", window.location.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reformSpec),
    });
    if (!res.ok) throw new Error("Grensejusteringen kunne ikke lagres på serveren");
    const { id } = (await res.json()) as { id: number };
    return id;
  } catch {
    throw new Error("Grensejusteringen kunne ikke lagres på serveren");
  }
}

export async function updateGrensejustering(
  id: number,
  request: OpprettGrensejusteringRequest,
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
    throw new Error("Grensejusteringen kunne ikke lagres på serveren");
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error("Fant ikke grensejusteringen");
    throw new Error("Grensejusteringen kunne ikke lagres på serveren");
  }
}

export async function listGrensejusteringer(): Promise<GrensejusteringSummary[]> {
  try {
    const res = await fetch(new URL("/api/regulering/api/reguleringer", window.location.origin));
    if (!res.ok) throw new Error("Grensejusteringer kunne ikke hentes fra serveren");
    const data = (await res.json()) as { id: number; navn: string }[];

    return data.map(({ id, navn }) => ({
      id,
      navn,
      fraKommunenummer: "", // Placeholder, replace with actual value if available
      tilKommunenummer: "", // Placeholder, replace with actual value if available
    }));
  } catch {
    throw new Error("Grensejusteringer kunne ikke hentes fra serveren");
  }
}

export async function getGrensejustering(id: number): Promise<GrensejusteringDetail> {
  let res: Response;
  try {
    res = await fetch(new URL(`/api/regulering/api/reguleringer/${id}`, window.location.origin));
  } catch {
    throw new Error("Grensejusteringen kunne ikke hentes fra serveren");
  }
  if (res.status === 404) throw new Error("Fant ikke grensejusteringen");
  if (!res.ok) throw new Error("Grensejusteringen kunne ikke hentes fra serveren");
  const data = (await res.json()) as ReformSpec;
  return fraReformSpec(id, data);
}
