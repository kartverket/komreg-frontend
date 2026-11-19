import { Button, Heading, Paragraph } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate, useParams } from "@tanstack/react-router";
import { updateGrensejustering } from "@/api/grensejusteringer";
import { BackButton } from "@/components/BackButton/BackButton";
import { lagRedigering, type GrensejusteringDetail } from "@/domain/grensejustering";
import { useGrensejustering } from "@/hooks/useGrensejustering";
import { GrensejusteringSkjema } from "./GrensejusteringSkjema";

function EditSkjema({ grensejustering }: { grensejustering: GrensejusteringDetail }) {
  const navigate = useNavigate();
  const grensejusteringId = String(grensejustering.id);
  const { grunnlag, startverdier } = lagRedigering(grensejustering);

  return (
    <GrensejusteringSkjema
      modus="rediger"
      grunnlag={grunnlag}
      startverdier={startverdier}
      onLagre={async (request) => {
        await updateGrensejustering(grensejustering.id, request);
        await navigate({
          to: "/grensejusteringer/$grensejusteringId",
          params: { grensejusteringId },
        });
      }}
      avbryt={
        <Button asChild variant="secondary">
          <RouterLink to="/grensejusteringer/$grensejusteringId" params={{ grensejusteringId }}>
            Avbryt
          </RouterLink>
        </Button>
      }
    />
  );
}

export function EditGrensejustering() {
  const { grensejusteringId } = useParams({ strict: false });
  const { grensejustering, error } = useGrensejustering(grensejusteringId);

  return (
    <>
      <BackButton to="/grensejusteringer">Tilbake til grensejusteringer</BackButton>
      <Heading level={1} data-size="lg">
        Rediger grensejustering
      </Heading>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !grensejustering ? (
        <Paragraph>Henter grensejustering…</Paragraph>
      ) : (
        <EditSkjema grensejustering={grensejustering} />
      )}
    </>
  );
}
