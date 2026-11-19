import { Button, Heading, Paragraph, Table } from "@kv-designsystem/react";
import { Link as RouterLink, useParams } from "@tanstack/react-router";
import { BackButton } from "@/components/BackButton/BackButton";
import { formatMatrikkelnummer, formatNyttMatrikkelnummer } from "@/domain/grensejustering";
import { formatNyVegadresse, formatVegadresse, vegadresseNokkel } from "@/domain/vegadresse";
import { useGrensejustering } from "@/hooks/useGrensejustering";

export function GrensejusteringDetail() {
  const { grensejusteringId } = useParams({ strict: false });
  const { id, grensejustering, error } = useGrensejustering(grensejusteringId);

  return (
    <>
      <BackButton to="/grensejusteringer">Tilbake til grensejusteringer</BackButton>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !grensejustering ? (
        <Paragraph>Henter grensejustering…</Paragraph>
      ) : (
        <>
          <Heading level={1} data-size="lg">
            {grensejustering.navn}
          </Heading>
          <Paragraph>
            {grensejustering.fraKommunenummer} → {grensejustering.tilKommunenummer}
          </Paragraph>
          <Button asChild variant="secondary">
            <RouterLink
              to="/grensejusteringer/$grensejusteringId/rediger"
              params={{ grensejusteringId: String(id) }}
            >
              Rediger grensejustering
            </RouterLink>
          </Button>
          <Heading level={2} data-size="sm">
            Matrikkelenheter
          </Heading>
          <div className="grensejustering-table-wrapper">
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
                {grensejustering.matrikkelenheter.map((item) => (
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
          {grensejustering.teiger.length > 0 && (
            <>
              <Heading level={2} data-size="sm">
                Teiger uten matrikkelnummer
              </Heading>
              <div className="grensejustering-table-wrapper">
                <Table data-size="sm" zebra>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Teig-ID</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {grensejustering.teiger.map((teig) => (
                      <Table.Row key={teig.teigId}>
                        <Table.Cell>{teig.teigId}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
          {grensejustering.vegadresser.length > 0 && (
            <>
              <Heading level={2} data-size="sm">
                Vegadresser
              </Heading>
              <div className="grensejustering-table-wrapper">
                <Table data-size="sm" zebra>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Adresse</Table.HeaderCell>
                      <Table.HeaderCell>Ny adresse</Table.HeaderCell>
                      <Table.HeaderCell>Ny adressekode</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {grensejustering.vegadresser.map((adresse) => (
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
