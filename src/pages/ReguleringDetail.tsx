import { useEffect, useState } from "react";
import { Heading, Paragraph, Table } from "@kv-designsystem/react";
import { useParams } from "@tanstack/react-router";
import { getRegulering } from "@/api/reguleringer";
import { BackButton } from "@/components/BackButton/BackButton";
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

  return (
    <>
      <BackButton to="/reguleringer">Tilbake til reguleringer</BackButton>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !regulering ? (
        <Paragraph>Henter regulering…</Paragraph>
      ) : (
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
          <div className="regulering-table-wrapper">
            <Table data-size="sm" zebra>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Gårdsnummer</Table.HeaderCell>
                  <Table.HeaderCell>Bruksnummer</Table.HeaderCell>
                  <Table.HeaderCell>Teiger</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {regulering.grensejustering.matrikkelenheter.map((item) => (
                  <Table.Row key={formatMatrikkelnummer(item)}>
                    <Table.Cell>{item.gardsnummer}</Table.Cell>
                    <Table.Cell>{item.bruksnummer ?? "Hele gårdsnummeret"}</Table.Cell>
                    <Table.Cell>{item.teigIder.length}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
