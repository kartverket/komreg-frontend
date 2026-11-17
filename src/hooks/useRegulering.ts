import { useEffect, useState } from "react";
import { getRegulering } from "@/api/reguleringer";
import type { ReguleringDetail } from "@/domain/regulering";

export function useRegulering(reguleringId: string | undefined) {
  const id = Number(reguleringId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [regulering, setRegulering] = useState<ReguleringDetail | null>(null);
  const [error, setError] = useState(validId ? "" : "Ugyldig regulerings-ID");

  useEffect(() => {
    if (!validId) return;
    let active = true;
    void getRegulering(id)
      .then((result) => {
        if (active) setRegulering(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Kunne ikke hente reguleringen");
        }
      });
    return () => {
      active = false;
    };
  }, [id, validId]);

  return { id, regulering, error };
}
