import { useState } from "react";
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Paragraph,
  Table,
  Textfield,
} from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { createRegulering } from "@/api/reguleringer";
import {
  finnOpptattMatrikkelnummer,
  formatMatrikkelnummer,
  gardsnummerNokkel,
  lagMatrikkelenhetDraft,
  matrikkelnumreITilKommune,
  medHeleGardsnummer,
  medNyeMatrikkelnumre,
  validerGrensejustering,
  type GrensejusteringDraft,
  type NyttMatrikkelnummerInput,
} from "@/domain/regulering";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import { finnEksisterendeMatrikkelnumre } from "@/utils/TeigUtils";

export function NewRegulering() {
  const navigate = useNavigate();
  const valgte = useMatrikkelenheter((state) => state.matrikkelenheter);
  const clearMatrikkelenheter = useMatrikkelenheter((state) => state.clearMatrikkelenheter);
  const drafts = Array.from(valgte.values(), lagMatrikkelenhetDraft);
  const utenMatrikkelnummer = drafts.filter((draft) => draft === null).length;
  const valgteEnheter = drafts.filter((draft) => draft !== null);
  const gardsnumre = [...new Set(valgteEnheter.map(gardsnummerNokkel))];
  const [heleGardsnummer, setHeleGardsnummer] = useState<ReadonlySet<string>>(new Set());
  const [nyeNumre, setNyeNumre] = useState<ReadonlyMap<string, NyttMatrikkelnummerInput>>(
    new Map(),
  );
  const matrikkelenheter = medNyeMatrikkelnumre(
    medHeleGardsnummer(valgteEnheter, heleGardsnummer),
    nyeNumre,
  );
  const [navn, setNavn] = useState("");
  const [dato, setDato] = useState("");
  const [fraKommune, setFraKommune] = useState(valgteEnheter[0]?.kommunenummer ?? "");
  const [tilKommune, setTilKommune] = useState("");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (utenMatrikkelnummer) {
      setError("Teiger uten matrikkelnummer kan ikke flyttes ennå. Fjern dem i kartet.");
      return;
    }
    const grensejustering: GrensejusteringDraft = {
      fraKommunenummer: fraKommune.trim(),
      tilKommunenummer: tilKommune.trim(),
      matrikkelenheter,
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

    try {
      const id = await createRegulering({ navn, dato, grensejustering });
      clearMatrikkelenheter();
      await navigate({ to: "/reguleringer/$reguleringId", params: { reguleringId: String(id) } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke opprette reguleringen");
      setSaving(false);
    }
  }

  return (
    <>
      <Heading level={1} data-size="lg">
        Opprett grensejustering
      </Heading>
      {!valgte.size ? (
        <Paragraph>Ingen matrikkelenheter er valgt. Velg dem i kartet først.</Paragraph>
      ) : (
        <form className="regulering-form" onSubmit={(event) => void submit(event)}>
          <Textfield
            label="Navn"
            value={navn}
            onChange={(event) => setNavn(event.target.value)}
            required
          />
          <Textfield
            label="Ikrafttredelsesdato"
            type="date"
            value={dato}
            onChange={(event) => setDato(event.target.value)}
            required
          />
          <Textfield
            label="Fra kommune"
            value={fraKommune}
            onChange={(event) => setFraKommune(event.target.value)}
            inputMode="numeric"
            required
          />
          <Textfield
            label="Til kommune"
            value={tilKommune}
            onChange={(event) => setTilKommune(event.target.value)}
            inputMode="numeric"
            required
          />
          <section>
            <Heading level={2} data-size="xs">
              Matrikkelenheter ({matrikkelenheter.length})
            </Heading>
            {gardsnumre.map((nokkel) => (
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
            {utenMatrikkelnummer > 0 && (
              <Paragraph>{utenMatrikkelnummer} teig(er) uten matrikkelnummer er valgt.</Paragraph>
            )}
          </section>
          {error && (
            <Paragraph className="form-error" role="alert">
              {error}
            </Paragraph>
          )}
          <div className="form-actions">
            <Button asChild variant="secondary">
              <RouterLink to="/kart">Tilbake til kartet</RouterLink>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Oppretter…" : "Opprett regulering"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
