import { useEffect, useState } from "react";
import { Heading, Paragraph } from "@kv-designsystem/react";
import { useParams } from "@tanstack/react-router";
import { getRegulering } from "@/api/reguleringer";
import { formatMatrikkelnummer, type ReguleringDetail as Detail } from "@/domain/regulering";

export function ReguleringDetail() {
  const { reguleringId } = useParams({ strict: false });
  const id = Number(reguleringId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [regulering, setRegulering] = useState<Detail | null>(null);
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

  if (error)
    return (
      <Paragraph className="form-error" role="alert">
        {error}
      </Paragraph>
    );
  if (!regulering) return <Paragraph>Henter regulering…</Paragraph>;
  return (
    <>
      <Heading level={1} data-size="lg">
        {regulering.navn}
      </Heading>
      <Paragraph>Ikrafttredelse: {regulering.dato}</Paragraph>
      <Paragraph>
        {regulering.grensejustering.fraKommunenummer} →{" "}
        {regulering.grensejustering.tilKommunenummer}
      </Paragraph>
      <Heading level={2} data-size="sm">
        Matrikkelenheter
      </Heading>
      <ul>
        {regulering.grensejustering.matrikkelenheter.map((item) => (
          <li key={formatMatrikkelnummer(item)}>{formatMatrikkelnummer(item)}</li>
        ))}
      </ul>
    </>
  );
}
