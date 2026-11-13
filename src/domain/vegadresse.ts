import type { Address } from "@/types/Address";

export type Veg = {
  adressekode: number;
  adressenavn: string;
};

// Bokstav er "" når adressen ikke har bokstav, som i adresse-API-et.
export type Husnummer = {
  nummer: number;
  bokstav: string;
};

// En vegadresse følger ikke med matrikkelenheten. Flyttingen kobler den fra vegen i fra
// kommune til en veg i til kommune.
export type VegadresseDraft = {
  kommunenummer: string;
  veg: Veg;
  husnummer: Husnummer;
  // Må velges før reguleringen kan opprettes.
  nyVeg?: Veg;
  // Undefined beholder dagens nummer og bokstav.
  nyttHusnummer?: Husnummer;
  // Hele vegen flyttes til til kommune og beholder adressekoden. Adressene følger med uendret.
  heleVegen?: boolean;
};

// Adressene på én veg i fra kommune. De flyttes til samme veg i til kommune.
export type VegGruppe = {
  nokkel: string;
  veg: Veg;
  adresser: VegadresseDraft[];
};

export type EksisterendeVegadresse = {
  adressekode: number;
  husnummer: Husnummer;
};

export function lagVegadresseDrafts(adresser: Address[]): VegadresseDraft[] {
  const vegadresser: VegadresseDraft[] = [];
  for (const { kommunenummer, adressekode, adressenavn, nummer, bokstav } of adresser) {
    if (!kommunenummer || adressekode === undefined || nummer === undefined) continue;
    vegadresser.push({
      kommunenummer,
      veg: { adressekode, adressenavn: adressenavn ?? "" },
      husnummer: { nummer, bokstav: bokstav ?? "" },
    });
  }
  return vegadresser;
}

export function formatHusnummer({ nummer, bokstav }: Husnummer): string {
  return `${nummer}${bokstav}`;
}

export function formatVeg({ adressekode, adressenavn }: Veg): string {
  return `${adressenavn} (${adressekode})`;
}

export function formatVegadresse({ veg, husnummer }: VegadresseDraft): string {
  return `${veg.adressenavn} ${formatHusnummer(husnummer)}`;
}

export function formatNyVegadresse({ nyVeg, nyttHusnummer, husnummer }: VegadresseDraft): string {
  if (!nyVeg) return "Ikke valgt";
  return `${nyVeg.adressenavn} ${formatHusnummer(nyttHusnummer ?? husnummer)}`;
}

export function vegNokkel({ kommunenummer, veg }: VegadresseDraft): string {
  return `${kommunenummer}-${veg.adressekode}`;
}

export function vegadresseNokkel(adresse: VegadresseDraft): string {
  return `${vegNokkel(adresse)}-${formatHusnummer(adresse.husnummer)}`;
}

export function grupperPaVeg(vegadresser: VegadresseDraft[]): VegGruppe[] {
  const grupper = new Map<string, VegGruppe>();
  for (const adresse of vegadresser) {
    const nokkel = vegNokkel(adresse);
    const gruppe = grupper.get(nokkel);
    if (gruppe) gruppe.adresser.push(adresse);
    else grupper.set(nokkel, { nokkel, veg: adresse.veg, adresser: [adresse] });
  }
  return [...grupper.values()];
}

// Ved en grensejustering fortsetter vegen ofte inn i til kommune med samme navn.
export function finnVegMedSammeNavn(veg: Veg, kandidater: Veg[]): Veg | undefined {
  const navn = veg.adressenavn.toLowerCase();
  return kandidater.find((kandidat) => kandidat.adressenavn.toLowerCase() === navn);
}

const HUSNUMMER = /^(\d+)\s*([a-zæøå]?)$/i;

// Tom tekst beholder dagens husnummer. Tekst som ikke er et husnummer gir NaN, som
// validerVegadresser avviser, slik som for matrikkelnumre.
function lesHusnummer(tekst: string): Husnummer | undefined {
  const trimmet = tekst.trim();
  if (!trimmet) return undefined;
  const treff = HUSNUMMER.exec(trimmet);
  if (!treff) return { nummer: Number.NaN, bokstav: "" };
  return { nummer: Number(treff[1]), bokstav: (treff[2] ?? "").toUpperCase() };
}

export type Vegadressevalg = {
  // Nøkkel: vegNokkel. Hele vegen flyttes, så ingen veg i til kommune velges.
  heleVeger: ReadonlySet<string>;
  // Nøkkel: vegNokkel. Vegen gjelder alle adressene på vegen i fra kommune.
  veger: ReadonlyMap<string, Veg>;
  // Nøkkel: vegadresseNokkel. Gir adressen en annen veg enn resten. null er ikke valgt ennå.
  egneVeger: ReadonlyMap<string, Veg | null>;
  // Nøkkel: vegadresseNokkel. Det brukeren har tastet inn.
  husnumre: ReadonlyMap<string, string>;
};

export function medNyeVegadresser(
  vegadresser: VegadresseDraft[],
  valg: Vegadressevalg,
): VegadresseDraft[] {
  return vegadresser.map((adresse) => {
    if (valg.heleVeger.has(vegNokkel(adresse))) {
      return { ...adresse, heleVegen: true, nyVeg: adresse.veg };
    }
    const nokkel = vegadresseNokkel(adresse);
    const nyVeg = valg.egneVeger.has(nokkel)
      ? (valg.egneVeger.get(nokkel) ?? undefined)
      : valg.veger.get(vegNokkel(adresse));
    const nyttHusnummer = lesHusnummer(valg.husnumre.get(nokkel) ?? "");
    return {
      ...adresse,
      ...(nyVeg && { nyVeg }),
      ...(nyttHusnummer && { nyttHusnummer }),
    };
  });
}

export function nyeAdressekoder(vegadresser: VegadresseDraft[]): number[] {
  return [...new Set(vegadresser.flatMap(({ nyVeg }) => (nyVeg ? [nyVeg.adressekode] : [])))];
}

function adresseNokkel(adressekode: number, husnummer: Husnummer): string {
  return `${adressekode}-${formatHusnummer(husnummer)}`;
}

// Null når vegen i til kommune ikke er valgt ennå.
function nyAdresseNokkel({ nyVeg, nyttHusnummer, husnummer }: VegadresseDraft): string | null {
  return nyVeg ? adresseNokkel(nyVeg.adressekode, nyttHusnummer ?? husnummer) : null;
}

// Gir vegadresseNokkel for adressene som havner på en adresse som finnes i til kommune, eller
// på samme adresse som en annen adresse i reguleringen.
export function finnKollisjoner(
  vegadresser: VegadresseDraft[],
  eksisterende: EksisterendeVegadresse[],
): Set<string> {
  const opptatte = new Set(
    eksisterende.map(({ adressekode, husnummer }) => adresseNokkel(adressekode, husnummer)),
  );
  const perNyAdresse = new Map<string, VegadresseDraft[]>();
  for (const adresse of vegadresser) {
    const nyAdresse = nyAdresseNokkel(adresse);
    if (nyAdresse === null) continue;
    perNyAdresse.set(nyAdresse, [...(perNyAdresse.get(nyAdresse) ?? []), adresse]);
  }
  const kollisjoner = new Set<string>();
  for (const [nyAdresse, adresser] of perNyAdresse) {
    if (adresser.length > 1 || opptatte.has(nyAdresse)) {
      for (const adresse of adresser) kollisjoner.add(vegadresseNokkel(adresse));
    }
  }
  return kollisjoner;
}

function forsteKollisjon(
  vegadresser: VegadresseDraft[],
  eksisterende: EksisterendeVegadresse[],
): VegadresseDraft | undefined {
  const kollisjoner = finnKollisjoner(vegadresser, eksisterende);
  return vegadresser.find((adresse) => kollisjoner.has(vegadresseNokkel(adresse)));
}

export function validerVegadresser(
  vegadresser: VegadresseDraft[],
  fraKommunenummer: string,
): string | null {
  if (vegadresser.some((adresse) => adresse.kommunenummer !== fraKommunenummer)) {
    return "Alle vegadressene må ligge i fra kommune";
  }
  const utenVeg = vegadresser.find((adresse) => !adresse.nyVeg);
  if (utenVeg) return `Velg veg i til kommune for ${formatVegadresse(utenVeg)}`;

  const ugyldig = vegadresser.find(({ nyttHusnummer }) => {
    const nummer = nyttHusnummer?.nummer;
    return nummer !== undefined && !(Number.isInteger(nummer) && nummer > 0);
  });
  if (ugyldig) {
    return `Nytt husnummer for ${formatVegadresse(ugyldig)} må være et tall, eventuelt med bokstav, for eksempel 12B`;
  }

  const kollisjon = forsteKollisjon(vegadresser, []);
  if (kollisjon) {
    return `Flere vegadresser får adressen ${formatNyVegadresse(kollisjon)} i til kommune`;
  }
  return null;
}

export function finnOpptattVegadresse(
  vegadresser: VegadresseDraft[],
  tilKommunenummer: string,
  eksisterende: EksisterendeVegadresse[],
): string | null {
  const opptatt = forsteKollisjon(vegadresser, eksisterende);
  if (!opptatt) return null;
  return `${formatVegadresse(opptatt)} får ${formatNyVegadresse(opptatt)}, som allerede finnes i ${tilKommunenummer}. Velg et annet husnummer.`;
}
