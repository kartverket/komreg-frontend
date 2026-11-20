import { useState, type ReactNode } from "react";
import {
  Button,
  Fieldset,
  Paragraph,
  Radio,
  Textfield,
  useRadioGroup,
} from "@kv-designsystem/react";
import {
  finnOpptattMatrikkelnummer,
  gardsnummerNokkel,
  matrikkelnumreITilKommune,
  medHeleGardsnummer,
  medNyeMatrikkelnumre,
  validerGrensejustering,
  type GrensejusteringDraft,
  type GrensejusteringLagring,
  type Grunnlag,
  type NyttMatrikkelnummerInput,
  type ReguleringSummary,
  type Startverdier,
} from "@/domain/regulering";
import { finnOpptattVegadresse, nyeAdressekoder } from "@/domain/vegadresse";
import { useVegvalg } from "@/hooks/useVegvalg";
import { finnEksisterendeVegadresser } from "@/utils/AdresseUtils";
import { finnEksisterendeMatrikkelnumre } from "@/utils/TeigUtils";
import { GrensejusteringSkjema } from "./GrensejusteringSkjema";

type Props = {
  modus: "opprett" | "rediger";
  grunnlag: Grunnlag;
  // Det som er fylt inn fra før, når en eksisterende grensejustering redigeres.
  startverdier?: Startverdier;
  reguleringer: ReguleringSummary[];
  // Kalles med en gyldig grensejustering. Feil den kaster vises i skjemaet.
  onLagre: (lagring: GrensejusteringLagring) => Promise<void>;
  avbryt: ReactNode;
};

export function ReguleringSkjema({
  modus,
  grunnlag,
  startverdier,
  reguleringer,
  onLagre,
  avbryt,
}: Props) {
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

  // "new", eller ID-en til en eksisterende regulering som grensejusteringen legges til i.
  const { getRadioProps, value: valgtRegulering } = useRadioGroup({
    name: "regulering",
    value: "new",
  });

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
      const eksisterendeReguleringId =
        modus === "opprett" && valgtRegulering !== "new" ? Number(valgtRegulering) : undefined;
      await onLagre({ navn, dato, grensejustering, eksisterendeReguleringId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke lagre reguleringen");
      setSaving(false);
    }
  }

  return (
    <form className="regulering-form" onSubmit={(event) => void submit(event)}>
      {modus === "opprett" && (
        <Fieldset>
          <Fieldset.Legend>Velg en regulering</Fieldset.Legend>
          <Radio label="Opprett ny regulering" {...getRadioProps("new")} />
          {reguleringer.map((regulering) => (
            <Radio
              key={regulering.id}
              label={regulering.navn}
              {...getRadioProps(String(regulering.id))}
            />
          ))}
        </Fieldset>
      )}
      {modus === "opprett" && valgtRegulering === "new" && (
        <>
          <Paragraph data-size="sm">
            Du oppretter en ny regulering med matrikkelenheter, teiger og vegadresser.
          </Paragraph>
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
        </>
      )}
      <GrensejusteringSkjema
        redigerer={redigerer}
        fraKommune={fraKommune}
        onFraKommuneChange={setFraKommune}
        tilKommune={tilKommune}
        onTilKommuneChange={endreTilKommune}
        gardsnumre={gardsnumre}
        heleGardsnummer={heleGardsnummer}
        onToggleHeleGardsnummer={toggleHeleGardsnummer}
        matrikkelenheter={matrikkelenheter}
        nyeNumre={nyeNumre}
        onEndreNyttNummer={endreNyttNummer}
        teiger={teiger}
        vegvalg={vegvalg}
      />
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
