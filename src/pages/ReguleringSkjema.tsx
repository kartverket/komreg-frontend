import { useState, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Paragraph,
  Table,
  Textfield,
} from "@kv-designsystem/react";
import {
  finnOpptattMatrikkelnummer,
  formatMatrikkelnummer,
  gardsnummerNokkel,
  matrikkelnumreITilKommune,
  medHeleGardsnummer,
  medNyeMatrikkelnumre,
  validerGrensejustering,
  type GrensejusteringDraft,
  type Grunnlag,
  type NyttMatrikkelnummerInput,
  type OpprettReguleringRequest,
  type Startverdier,
} from "@/domain/regulering";
import { finnOpptattVegadresse, nyeAdressekoder } from "@/domain/vegadresse";
import { useVegvalg } from "@/hooks/useVegvalg";
import { finnEksisterendeVegadresser } from "@/utils/AdresseUtils";
import { finnEksisterendeMatrikkelnumre } from "@/utils/TeigUtils";
import { FlyttVegadresser } from "./FlyttVegadresser";

type Props = {
  modus: "opprett" | "rediger";
  grunnlag: Grunnlag;
  // Det som er fylt inn fra før, når en eksisterende regulering redigeres.
  startverdier?: Startverdier;
  // Kalles med en gyldig regulering. Feil den kaster vises i skjemaet.
  onLagre: (request: OpprettReguleringRequest) => Promise<void>;
  avbryt: ReactNode;
};

export function ReguleringSkjema({ modus, grunnlag, startverdier, onLagre, avbryt }: Props) {
  const redigerer = modus === "rediger";
  const { matrikkelenheter: valgteEnheter, teiger } = grunnlag;
  const vegvalg = useVegvalg(
    grunnlag.vegadresser,
    startverdier && {
      tilKommunenummer: startverdier.tilKommunenummer,
      valg: startverdier.vegvalg,
    },
  );
  const { vegadresser } = vegvalg;
  const gardsnumre = [...new Set(valgteEnheter.map(gardsnummerNokkel))];
  const [heleGardsnummer, setHeleGardsnummer] = useState<ReadonlySet<string>>(new Set());
  const [nyeNumre, setNyeNumre] = useState<ReadonlyMap<string, NyttMatrikkelnummerInput>>(
    startverdier?.nyeNumre ?? new Map(),
  );
  const matrikkelenheter = medNyeMatrikkelnumre(
    medHeleGardsnummer(valgteEnheter, heleGardsnummer),
    nyeNumre,
  );
  const [navn, setNavn] = useState(startverdier?.navn ?? "");
  const [dato, setDato] = useState(startverdier?.dato ?? "");
  const [fraKommune, setFraKommune] = useState(
    startverdier?.fraKommunenummer ??
      valgteEnheter[0]?.kommunenummer ??
      teiger[0]?.kommunenummer ??
      "",
  );
  const [tilKommune, setTilKommune] = useState(startverdier?.tilKommunenummer ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleHeleGardsnummer(nokkel: string, checked: boolean) {
    const neste = new Set(heleGardsnummer);
    if (checked) neste.add(nokkel);
    else neste.delete(nokkel);
    setHeleGardsnummer(neste);
  }

  function endreNyttNummer(nokkel: string, felt: keyof NyttMatrikkelnummerInput, verdi: string) {
    setNyeNumre((forrige) => {
      const neste = new Map(forrige);
      neste.set(nokkel, {
        gardsnummer: "",
        bruksnummer: "",
        ...forrige.get(nokkel),
        [felt]: verdi,
      });
      return neste;
    });
  }

  function endreTilKommune(kommunenummer: string) {
    setTilKommune(kommunenummer);
    vegvalg.byttTilKommune(kommunenummer.trim());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const grensejustering: GrensejusteringDraft = {
      fraKommunenummer: fraKommune.trim(),
      tilKommunenummer: tilKommune.trim(),
      matrikkelenheter,
      teiger,
      vegadresser,
    };
    const valideringsfeil = validerGrensejustering(grensejustering);
    if (valideringsfeil) {
      setError(valideringsfeil);
      return;
    }

    setError("");
    setSaving(true);
    const eksisterende = await finnEksisterendeMatrikkelnumre(
      grensejustering.tilKommunenummer,
      matrikkelnumreITilKommune(matrikkelenheter),
    ).catch((error) => console.log(error));
    if (!eksisterende) {
      setError("Kunne ikke sjekke matrikkelnumrene mot matrikkelen. Prøv igjen.");
      setSaving(false);
      return;
    }
    const opptatt = finnOpptattMatrikkelnummer(
      matrikkelenheter,
      grensejustering.tilKommunenummer,
      eksisterende,
    );
    if (opptatt) {
      setError(opptatt);
      setSaving(false);
      return;
    }

    const eksisterendeVegadresser = await finnEksisterendeVegadresser(
      grensejustering.tilKommunenummer,
      nyeAdressekoder(vegadresser),
    ).catch((error) => console.log(error));
    if (!eksisterendeVegadresser) {
      setError("Kunne ikke sjekke vegadressene mot adresseregisteret. Prøv igjen.");
      setSaving(false);
      return;
    }
    const opptattVegadresse = finnOpptattVegadresse(
      vegadresser,
      grensejustering.tilKommunenummer,
      eksisterendeVegadresser,
    );
    if (opptattVegadresse) {
      setError(opptattVegadresse);
      setSaving(false);
      return;
    }

    try {
      await onLagre({ navn, dato, grensejustering });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke lagre reguleringen");
      setSaving(false);
    }
  }

  return (
    <form className="regulering-form" onSubmit={(event) => void submit(event)}>
      <Textfield
        className="regulering-felt"
        label="Navn"
        value={navn}
        onChange={(event) => setNavn(event.target.value)}
        required
      />
      <Textfield
        className="regulering-felt"
        label="Ikrafttredelsesdato"
        type="date"
        value={dato}
        onChange={(event) => setDato(event.target.value)}
        required
      />
      <Textfield
        className="regulering-felt"
        label="Fra kommune"
        value={fraKommune}
        onChange={(event) => setFraKommune(event.target.value)}
        inputMode="numeric"
        // Matrikkelenhetene, teigene og adressene ligger i fra kommune, og kan ikke byttes her.
        readOnly={redigerer}
        required
      />
      <Textfield
        className="regulering-felt"
        label="Til kommune"
        value={tilKommune}
        onChange={(event) => endreTilKommune(event.target.value)}
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
              onChange={(event) => toggleHeleGardsnummer(nokkel, event.target.checked)}
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
                          endreNyttNummer(nokkel, "gardsnummer", event.target.value)
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
                            endreNyttNummer(nokkel, "bruksnummer", event.target.value)
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
      {vegadresser.length > 0 && <FlyttVegadresser vegvalg={vegvalg} />}
      {error && (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      )}
      <div className="form-actions">
        {avbryt}
        <Button type="submit" disabled={saving}>
          {redigerer
            ? saving
              ? "Lagrer…"
              : "Lagre endringer"
            : saving
              ? "Oppretter…"
              : "Opprett regulering"}
        </Button>
      </div>
    </form>
  );
}
