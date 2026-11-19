import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate, useParams } from "@tanstack/react-router";
import { updateRegulering } from "@/api/reguleringer";
import { BackButton } from "@/components/BackButton/BackButton";
import { lagRedigering, type ReguleringDetail } from "@/domain/regulering";
import { useRegulering } from "@/hooks/useRegulering";
import { ReguleringSkjema } from "./ReguleringSkjema";

function EditSkjema({ regulering }: { regulering: ReguleringDetail }) {
  const navigate = useNavigate();
  const reguleringId = String(regulering.id);
  const { grunnlag, startverdier } = lagRedigering(regulering);

  return (
    <ReguleringSkjema
      modus="rediger"
      grunnlag={grunnlag}
      startverdier={startverdier}
      onLagre={async (request) => {
        await updateRegulering(regulering.id, request);
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
        Rediger regulering
      </Heading>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !regulering ? (
        <Paragraph>Henter regulering…</Paragraph>
      ) : (
        <EditSkjema regulering={regulering} />
      )}
    </>
  );
}
