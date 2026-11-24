import { Checkbox, Heading, Input, Paragraph, Table, Textfield } from "@kv-designsystem/react";
import {
  formatMatrikkelnummer,
  type MatrikkelenhetDraft,
  type NyttMatrikkelnummerInput,
  type TeigDraft,
} from "@/domain/regulering";
import type { Vegvalgstate } from "@/hooks/useVegvalg";
import { FlyttVegadresser } from "./FlyttVegadresser";

type Props = {
  redigerer: boolean;
  fraKommune: string;
  onFraKommuneChange: (kommunenummer: string) => void;
  tilKommune: string;
  onTilKommuneChange: (kommunenummer: string) => void;
  gardsnumre: string[];
  heleGardsnummer: ReadonlySet<string>;
  onToggleHeleGardsnummer: (nokkel: string, checked: boolean) => void;
  matrikkelenheter: MatrikkelenhetDraft[];
  nyeNumre: ReadonlyMap<string, NyttMatrikkelnummerInput>;
  onEndreNyttNummer: (nokkel: string, felt: keyof NyttMatrikkelnummerInput, verdi: string) => void;
  teiger: TeigDraft[];
  vegvalg: Vegvalgstate;
};

export function GrensejusteringSkjema({
  redigerer,
  fraKommune,
  onFraKommuneChange,
  tilKommune,
  onTilKommuneChange,
  gardsnumre,
  heleGardsnummer,
  onToggleHeleGardsnummer,
  matrikkelenheter,
  nyeNumre,
  onEndreNyttNummer,
  teiger,
  vegvalg,
}: Props) {
  return (
    <>
      <Textfield
        className="regulering-felt"
        label="Fra kommune"
        value={fraKommune}
        onChange={(event) => onFraKommuneChange(event.target.value)}
        inputMode="numeric"
        // Matrikkelenhetene, teigene og adressene ligger i fra kommune, og kan ikke byttes her.
        readOnly={redigerer}
        required
      />
      <Textfield
        className="regulering-felt"
        label="Til kommune"
        value={tilKommune}
        onChange={(event) => onTilKommuneChange(event.target.value)}
        inputMode="numeric"
        required
      />
      <section>
        <Heading level={2} data-size="xs">
          Matrikkelenheter ({matrikkelenheter.length})
        </Heading>
        {!redigerer &&
          gardsnumre.map((nokkel) => (
            <Checkbox
              key={nokkel}
              label={`Flytt hele gårdsnummer ${nokkel}`}
              checked={heleGardsnummer.has(nokkel)}
              onChange={(event) => onToggleHeleGardsnummer(nokkel, event.target.checked)}
            />
          ))}
        <Paragraph data-size="sm">
          Fyll inn nytt gårds- og bruksnummer der matrikkelenheten skal få nytt nummer i til
          kommune. Tomme felt beholder dagens nummer.
        </Paragraph>
        <div className="regulering-table-wrapper">
          <Table data-size="sm" zebra>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Matrikkelenhet</Table.HeaderCell>
                <Table.HeaderCell>Nytt gårdsnummer</Table.HeaderCell>
                <Table.HeaderCell>Nytt bruksnummer</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {matrikkelenheter.map((item) => {
                const nokkel = formatMatrikkelnummer(item);
                const input = nyeNumre.get(nokkel);
                return (
                  <Table.Row key={nokkel}>
                    <Table.Cell>{nokkel}</Table.Cell>
                    <Table.Cell>
                      <Input
                        className="matrikkelnummer-input"
                        aria-label={`Nytt gårdsnummer for ${nokkel}`}
                        inputMode="numeric"
                        placeholder={String(item.gardsnummer)}
                        value={input?.gardsnummer ?? ""}
                        onChange={(event) =>
                          onEndreNyttNummer(nokkel, "gardsnummer", event.target.value)
                        }
                      />
                    </Table.Cell>
                    <Table.Cell>
                      {item.bruksnummer === null ? (
                        "Beholdes"
                      ) : (
                        <Input
                          className="matrikkelnummer-input"
                          aria-label={`Nytt bruksnummer for ${nokkel}`}
                          inputMode="numeric"
                          placeholder={String(item.bruksnummer)}
                          value={input?.bruksnummer ?? ""}
                          onChange={(event) =>
                            onEndreNyttNummer(nokkel, "bruksnummer", event.target.value)
                          }
                        />
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </section>
      {teiger.length > 0 && (
        <section>
          <Heading level={2} data-size="xs">
            Teiger uten matrikkelnummer ({teiger.length})
          </Heading>
          <Paragraph data-size="sm">
            Teigene beholder teig-ID-en og er fortsatt uten matrikkelnummer i til kommune.
          </Paragraph>
          <div className="regulering-table-wrapper">
            <Table data-size="sm" zebra>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Teig-ID</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {teiger.map((teig) => (
                  <Table.Row key={teig.teigId}>
                    <Table.Cell>{teig.teigId}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </section>
      )}
      {vegvalg.vegadresser.length > 0 && <FlyttVegadresser vegvalg={vegvalg} />}
    </>
  );
}
