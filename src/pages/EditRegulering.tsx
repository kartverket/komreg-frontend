import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { updateRegulering } from "@/api/reguleringer";
import { BackButton } from "@/components/BackButton/BackButton";
import { lagRedigering, medGrensejustering, type ReguleringDetail } from "@/domain/regulering";
import { useRegulering } from "@/hooks/useRegulering";
import { ReguleringSkjema } from "./ReguleringSkjema";

const ROUTE = "/layout/reguleringer/$reguleringId/rediger";

function EditSkjema({ regulering }: { regulering: ReguleringDetail }) {
  const navigate = useNavigate();
  const indeks = useSearch({ from: ROUTE }).grensejustering ?? 0;
  const reguleringId = String(regulering.id);
  const redigering = lagRedigering(regulering, indeks);

  if (!redigering) {
    return (
      <Paragraph className="form-error" role="alert">
        Fant ikke grensejusteringen
      </Paragraph>
    );
  }

  return (
    <ReguleringSkjema
      modus="rediger"
      grunnlag={redigering.grunnlag}
      startverdier={redigering.startverdier}
      onLagre={async ({ grensejustering }) => {
        await updateRegulering(
          regulering.id,
          medGrensejustering(regulering, grensejustering, indeks),
        );
        await navigate({ to: "/reguleringer/$reguleringId", params: { reguleringId } });
      }}
      avbryt={
        <Button asChild variant="secondary">
          <RouterLink to="/reguleringer/$reguleringId" params={{ reguleringId }}>
            Avbryt
          </RouterLink>
        </Button>
      }
    />
  );
}

export function EditRegulering() {
  const { reguleringId } = useParams({ strict: false });
  const { regulering, error } = useRegulering(reguleringId);

  return (
    <>
      <BackButton to="/reguleringer">Tilbake til reguleringer</BackButton>
      <Heading level={1} data-size="lg">
        Rediger grensejustering
      </Heading>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !regulering ? (
        <Paragraph>Henter regulering…</Paragraph>
      ) : (
        <>
          <Paragraph>Regulering: {regulering.navn}</Paragraph>
          <EditSkjema regulering={regulering} />
        </>
      )}
    </>
  );
}
