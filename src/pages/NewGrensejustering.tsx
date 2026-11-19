import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { createGrensejustering } from "@/api/grensejusteringer";
import { lagMatrikkelenhetDraft, lagTeigDraft } from "@/domain/grensejustering";
import { lagVegadresseDrafts } from "@/domain/vegadresse";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import { GrensejusteringSkjema } from "./GrensejusteringSkjema";

export function NewGrensejustering() {
  const navigate = useNavigate();
  const valgte = useMatrikkelenheter((state) => state.matrikkelenheter);
  const clearMatrikkelenheter = useMatrikkelenheter((state) => state.clearMatrikkelenheter);
  const grunnlag = {
    matrikkelenheter: Array.from(valgte.values(), lagMatrikkelenhetDraft).filter(
      (draft) => draft !== null,
    ),
    teiger: Array.from(valgte.values(), lagTeigDraft).flat(),
    vegadresser: lagVegadresseDrafts(
      Array.from(valgte.values(), (enhet) => enhet.addresses ?? []).flat(),
    ),
  };

  return (
    <>
      <Heading level={1} data-size="lg">
        Opprett grensejustering
      </Heading>
      {!valgte.size ? (
        <Paragraph>Ingen matrikkelenheter er valgt. Velg dem i kartet først.</Paragraph>
      ) : (
        <GrensejusteringSkjema
          modus="opprett"
          grunnlag={grunnlag}
          onLagre={async (request) => {
            const id = await createGrensejustering(request);
            clearMatrikkelenheter();
            await navigate({
              to: "/grensejusteringer/$grensejusteringId",
              params: { grensejusteringId: String(id) },
            });
          }}
          avbryt={
            <Button asChild variant="secondary">
              <RouterLink to="/kart">Tilbake til kartet</RouterLink>
            </Button>
          }
        />
      )}
    </>
  );
}
