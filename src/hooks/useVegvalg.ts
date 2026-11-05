import { useState } from "react";
import {
  finnKollisjoner,
  finnVegMedSammeNavn,
  grupperPaVeg,
  medNyeVegadresser,
  type EksisterendeVegadresse,
  type Veg,
  type VegadresseDraft,
  type Vegadressevalg,
} from "@/domain/vegadresse";
import { finnEksisterendeVegadresser, sokVeger } from "@/utils/AdresseUtils";

// Alt her gjelder én til kommune og nullstilles når den endres. Svar fra API-et for en
// tidligere til kommune forkastes, fordi de sjekker tilKommunenummer.
type Vegvalg = Vegadressevalg & {
  tilKommunenummer: string;
  // Adressene som finnes på vegene som er valgt i til kommune, per adressekode.
  eksisterende: ReadonlyMap<number, EksisterendeVegadresse[]>;
};

function tomtVegvalg(tilKommunenummer: string): Vegvalg {
  return {
    tilKommunenummer,
    veger: new Map(),
    egneVeger: new Map(),
    husnumre: new Map(),
    eksisterende: new Map(),
  };
}

export type Adressestatus = "ikke-valgt" | "sjekker" | "ledig" | "opptatt";

export function useVegvalg(valgteVegadresser: VegadresseDraft[]) {
  const [vegvalg, setVegvalg] = useState(() => tomtVegvalg(""));
  const vegadresser = medNyeVegadresser(valgteVegadresser, vegvalg);
  const kollisjoner = finnKollisjoner(vegadresser, [...vegvalg.eksisterende.values()].flat());

  function oppdater(tilKommunenummer: string, endring: (forrige: Vegvalg) => Vegvalg) {
    setVegvalg((forrige) =>
      forrige.tilKommunenummer === tilKommunenummer ? endring(forrige) : forrige,
    );
  }

  // Henter husnumrene på vegen, så kollisjoner kan vises med en gang. Feiler det, sjekkes
  // de uansett når reguleringen opprettes.
  function hentEksisterende(tilKommunenummer: string, veg: Veg) {
    void finnEksisterendeVegadresser(tilKommunenummer, [veg.adressekode])
      .then((adresser) =>
        oppdater(tilKommunenummer, (forrige) => ({
          ...forrige,
          eksisterende: new Map(forrige.eksisterende).set(veg.adressekode, adresser),
        })),
      )
      .catch((error) => console.log(error));
  }

  function velgVeg(nokkel: string, veg: Veg | undefined) {
    const { tilKommunenummer } = vegvalg;
    oppdater(tilKommunenummer, (forrige) => {
      const veger = new Map(forrige.veger);
      if (veg) veger.set(nokkel, veg);
      else veger.delete(nokkel);
      return { ...forrige, veger };
    });
    if (veg) hentEksisterende(tilKommunenummer, veg);
  }

  function endreHusnummer(nokkel: string, husnummer: string) {
    oppdater(vegvalg.tilKommunenummer, (forrige) => ({
      ...forrige,
      husnumre: new Map(forrige.husnumre).set(nokkel, husnummer),
    }));
  }

  // Velger veg med samme navn i til kommune der den finnes, uten å overstyre det brukeren
  // har rukket å velge selv.
  function foreslaVeger(tilKommunenummer: string) {
    for (const gruppe of grupperPaVeg(valgteVegadresser)) {
      void sokVeger(tilKommunenummer, gruppe.veg.adressenavn)
        .then((kandidater) => {
          const veg = finnVegMedSammeNavn(gruppe.veg, kandidater);
          if (!veg) return;
          oppdater(tilKommunenummer, (forrige) =>
            forrige.veger.has(gruppe.nokkel)
              ? forrige
              : { ...forrige, veger: new Map(forrige.veger).set(gruppe.nokkel, veg) },
          );
          hentEksisterende(tilKommunenummer, veg);
        })
        .catch((error) => console.log(error));
    }
  }

  function byttTilKommune(tilKommunenummer: string) {
    setVegvalg(tomtVegvalg(tilKommunenummer));
    if (/^\d{4}$/.test(tilKommunenummer)) foreslaVeger(tilKommunenummer);
  }

  function status(adresse: VegadresseDraft, nokkel: string): Adressestatus {
    if (!adresse.nyVeg) return "ikke-valgt";
    if (kollisjoner.has(nokkel)) return "opptatt";
    if (!vegvalg.eksisterende.has(adresse.nyVeg.adressekode)) return "sjekker";
    return "ledig";
  }

  return {
    vegadresser,
    grupper: grupperPaVeg(vegadresser),
    tilKommunenummer: vegvalg.tilKommunenummer,
    valgtVeg: (nokkel: string) => vegvalg.veger.get(nokkel),
    husnummer: (nokkel: string) => vegvalg.husnumre.get(nokkel) ?? "",
    status,
    velgVeg,
    endreHusnummer,
    byttTilKommune,
  };
}

export type Vegvalgstate = ReturnType<typeof useVegvalg>;
