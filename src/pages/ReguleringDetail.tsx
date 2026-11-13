import { useEffect, useState } from "react";
import { Heading, Paragraph, Table } from "@kv-designsystem/react";
import { useParams } from "@tanstack/react-router";
import { getRegulering } from "@/api/reguleringer";
import { BackButton } from "@/components/BackButton/BackButton";
import {
  formatMatrikkelnummer,
  formatNyttMatrikkelnummer,
  type ReguleringDetail as Detail,
} from "@/domain/regulering";
import { formatNyVegadresse, formatVegadresse, vegadresseNokkel } from "@/domain/vegadresse";

export function ReguleringDetail() {
  const { reguleringId } = useParams({ strict: false });
  const id = Number(reguleringId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [regulering, setRegulering] = useState<Detail | null>(null);
  const [error, setError] = useState(validId ? "" : "Ugyldig regulerings-ID");
  console.log(regulering);
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
                  <Table.HeaderCell>Nytt matrikkelnummer</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {regulering.grensejustering.matrikkelenheter.map((item) => (
                  <Table.Row key={formatMatrikkelnummer(item)}>
                    <Table.Cell>{item.gardsnummer}</Table.Cell>
                    <Table.Cell>{item.bruksnummer ?? "Hele gårdsnummeret"}</Table.Cell>
                    <Table.Cell>{item.teigIder.length}</Table.Cell>
                    <Table.Cell>{formatNyttMatrikkelnummer(item)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          {regulering.grensejustering.teiger.length > 0 && (
            <>
              <Heading level={2} data-size="sm">
                Teiger uten matrikkelnummer
              </Heading>
              <div className="regulering-table-wrapper">
                <Table data-size="sm" zebra>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Teig-ID</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {regulering.grensejustering.teiger.map((teig) => (
                      <Table.Row key={teig.teigId}>
                        <Table.Cell>{teig.teigId}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
          {regulering.grensejustering.vegadresser.length > 0 && (
            <>
              <Heading level={2} data-size="sm">
                Vegadresser
              </Heading>
              <div className="regulering-table-wrapper">
                <Table data-size="sm" zebra>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Adresse</Table.HeaderCell>
                      <Table.HeaderCell>Ny adresse</Table.HeaderCell>
                      <Table.HeaderCell>Ny adressekode</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {regulering.grensejustering.vegadresser.map((adresse) => (
                      <Table.Row key={vegadresseNokkel(adresse)}>
                        <Table.Cell>{formatVegadresse(adresse)}</Table.Cell>
                        <Table.Cell>{formatNyVegadresse(adresse)}</Table.Cell>
                        <Table.Cell>{adresse.nyVeg?.adressekode}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
