import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useLoaderData, useNavigate } from "@tanstack/react-router";
import { createRegulering, getRegulering, updateRegulering } from "@/api/reguleringer";
import { lagMatrikkelenhetDraft, lagTeigDraft, medGrensejustering } from "@/domain/regulering";
import { lagVegadresseDrafts } from "@/domain/vegadresse";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import { ReguleringSkjema } from "./ReguleringSkjema";

export function NewRegulering() {
  const navigate = useNavigate();
  const reguleringer = useLoaderData({ from: "/layout/reguleringer/ny" });
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
          reguleringer={reguleringer}
          onLagre={async ({ navn, dato, grensejustering, eksisterendeReguleringId }) => {
            let id: number;
            if (eksisterendeReguleringId === undefined) {
              id = await createRegulering({ navn, dato, grensejusteringer: [grensejustering] });
            } else {
              id = eksisterendeReguleringId;
              const regulering = await getRegulering(id);
              await updateRegulering(id, medGrensejustering(regulering, grensejustering));
            }
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
