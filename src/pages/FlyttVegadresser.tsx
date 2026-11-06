import { Heading, Input, Paragraph, Table } from "@kv-designsystem/react";
import {
  formatHusnummer,
  formatNyVegadresse,
  formatVeg,
  formatVegadresse,
  vegadresseNokkel,
} from "@/domain/vegadresse";
import type { Adressestatus, Vegvalgstate } from "@/hooks/useVegvalg";
import { VegVelger } from "./VegVelger";

const STATUSTEKST: Record<Adressestatus, string> = {
  "ikke-valgt": "",
  sjekker: "Sjekker…",
  ledig: "Ledig",
  opptatt: "Opptatt",
};

export function FlyttVegadresser({ vegvalg }: { vegvalg: Vegvalgstate }) {
  return (
    <section>
      <Heading level={2} data-size="xs">
        Vegadresser ({vegvalg.vegadresser.length})
      </Heading>
      <Paragraph data-size="sm">
        Velg vegen i til kommune som adressene skal kobles til. Finnes det en veg med samme navn, er
        den valgt. Er adressen opptatt, fyller du inn et nytt husnummer, for eksempel 12B.
      </Paragraph>
      {vegvalg.grupper.map((gruppe) => {
        const vegnavn = formatVeg(gruppe.veg);
        return (
          <section key={gruppe.nokkel} className="veg-gruppe">
            <Heading level={3} data-size="2xs">
              {vegnavn}
            </Heading>
            <VegVelger
              key={vegvalg.tilKommunenummer}
              tilKommunenummer={vegvalg.tilKommunenummer}
              label={`Veg i til kommune for ${vegnavn}`}
              valgt={vegvalg.valgtVeg(gruppe.nokkel)}
              onVelg={(veg) => vegvalg.velgVeg(gruppe.nokkel, veg)}
            />
            <div className="regulering-table-wrapper">
              <Table data-size="sm" zebra>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Adresse</Table.HeaderCell>
                    <Table.HeaderCell>Ny adresse</Table.HeaderCell>
                    <Table.HeaderCell>Nytt husnummer</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {gruppe.adresser.map((adresse) => {
                    const nokkel = vegadresseNokkel(adresse);
                    const tekst = formatVegadresse(adresse);
                    const status = vegvalg.status(adresse, nokkel);
                    return (
                      <Table.Row key={nokkel}>
                        <Table.Cell>{tekst}</Table.Cell>
                        <Table.Cell>{formatNyVegadresse(adresse)}</Table.Cell>
                        <Table.Cell>
                          <Input
                            className="husnummer-input"
                            aria-label={`Nytt husnummer for ${tekst}`}
                            placeholder={formatHusnummer(adresse.husnummer)}
                            value={vegvalg.husnummer(nokkel)}
                            onChange={(event) => vegvalg.endreHusnummer(nokkel, event.target.value)}
                          />
                        </Table.Cell>
                        <Table.Cell className={status === "opptatt" ? "form-error" : undefined}>
                          {STATUSTEKST[status]}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            </div>
          </section>
        );
      })}
    </section>
  );
}
