import type { EksisterendeVegadresse, Veg } from "@/domain/vegadresse";

const ADRESSESOK = "https://ws.geonorge.no/adresser/v1/sok";

type Adressetreff = {
  adressekode: number;
  adressenavn: string;
  nummer: number;
  bokstav: string;
};

// 1000 er det meste API-et gir per side.
async function sokVegadresser(sok: Record<string, string>): Promise<Adressetreff[]> {
  const params = new URLSearchParams({
    ...sok,
    objtype: "Vegadresse",
    treffPerSide: "1000",
    filtrer: "adresser.adressekode,adresser.adressenavn,adresser.nummer,adresser.bokstav",
  });
  const res = await fetch(`${ADRESSESOK}?${params}`);
  if (!res.ok) {
    throw new Error(`Kartverket API returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { adresser?: Adressetreff[] };
  return data.adresser ?? [];
}

// Adresse-API-et kan ikke søke etter veger, så vi søker etter adresser og tar med hver veg én gang.
export async function sokVeger(kommunenummer: string, navn: string): Promise<Veg[]> {
  const adresser = await sokVegadresser({ kommunenummer, adressenavn: `${navn.trim()}*` });
  const veger = new Map<number, Veg>();
  for (const { adressekode, adressenavn } of adresser) {
    veger.set(adressekode, { adressekode, adressenavn });
  }
  return [...veger.values()];
}

export async function finnEksisterendeVegadresser(
  kommunenummer: string,
  adressekoder: number[],
): Promise<EksisterendeVegadresse[]> {
  const perVeg = await Promise.all(
    adressekoder.map(async (adressekode) => {
      const adresser = await sokVegadresser({ kommunenummer, adressekode: String(adressekode) });
      return adresser.map(({ nummer, bokstav }) => ({
        adressekode,
        husnummer: { nummer, bokstav },
      }));
    }),
  );
  return perVeg.flat();
}
