import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { createRegulering } from "@/api/reguleringer";
import { lagMatrikkelenhetDraft, lagTeigDraft } from "@/domain/regulering";
import { lagVegadresseDrafts } from "@/domain/vegadresse";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import { ReguleringSkjema } from "./ReguleringSkjema";

export function NewRegulering() {
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
        <ReguleringSkjema
          modus="opprett"
          grunnlag={grunnlag}
          onLagre={async (request) => {
            const id = await createRegulering(request);
            clearMatrikkelenheter();
            await navigate({
              to: "/reguleringer/$reguleringId",
              params: { reguleringId: String(id) },
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
