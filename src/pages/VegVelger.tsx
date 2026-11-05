import { useRef, useState } from "react";
import { Suggestion } from "@kv-designsystem/react";
import { formatVeg, type Veg } from "@/domain/vegadresse";
import { sokVeger } from "@/utils/AdresseUtils";

type Props = {
  tilKommunenummer: string;
  label: string;
  valgt: Veg | undefined;
  onVelg: (veg: Veg | undefined) => void;
};

// Søker etter veger i til kommune mens brukeren skriver.
export function VegVelger({ tilKommunenummer, label, valgt, onVelg }: Props) {
  const [treff, setTreff] = useState<Veg[]>([]);
  // Svarene kan komme i en annen rekkefølge enn søkene. Bare svaret på siste søk vises.
  const sisteSok = useRef("");

  function sok(tekst: string) {
    sisteSok.current = tekst;
    if (tekst.trim().length < 2) {
      setTreff([]);
      return;
    }
    void sokVeger(tilKommunenummer, tekst)
      .then((veger) => {
        if (sisteSok.current === tekst) setTreff(veger);
      })
      .catch((error) => console.log(error));
  }

  const veger =
    valgt && !treff.some((veg) => veg.adressekode === valgt.adressekode)
      ? [valgt, ...treff]
      : treff;

  return (
    <Suggestion
      filter={false}
      data-sr-clear="Fjern valgt veg"
      selected={valgt ? { label: formatVeg(valgt), value: String(valgt.adressekode) } : null}
      onSelectedChange={(item) =>
        onVelg(veger.find((veg) => String(veg.adressekode) === item?.value))
      }
    >
      <Suggestion.Input
        aria-label={label}
        disabled={!/^\d{4}$/.test(tilKommunenummer)}
        onInput={(event) => sok(event.currentTarget.value)}
      />
      <Suggestion.Clear />
      <Suggestion.List>
        <Suggestion.Empty>Ingen veger funnet</Suggestion.Empty>
        {veger.map((veg) => (
          <Suggestion.Option key={veg.adressekode} value={String(veg.adressekode)}>
            {formatVeg(veg)}
          </Suggestion.Option>
        ))}
      </Suggestion.List>
    </Suggestion>
  );
}
