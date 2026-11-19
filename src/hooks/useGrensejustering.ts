import { useEffect, useState } from "react";
import { getGrensejustering } from "@/api/grensejusteringer";
import type { GrensejusteringDetail } from "@/domain/grensejustering";

export function useGrensejustering(grensejusteringId: string | undefined) {
  const id = Number(grensejusteringId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [grensejustering, setGrensejustering] = useState<GrensejusteringDetail | null>(null);
  const [error, setError] = useState(validId ? "" : "Ugyldig grensejusterings-ID");

  useEffect(() => {
    if (!validId) return;
    let active = true;
    void getGrensejustering(id)
      .then((result) => {
        if (active) setGrensejustering(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Kunne ikke hente grensejusteringen");
        }
      });
    return () => {
      active = false;
    };
  }, [id, validId]);

  return { id, grensejustering, error };
}
