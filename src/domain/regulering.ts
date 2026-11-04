import type { Matrikkelenhet } from "@/types/Matrikkelenhet";

export type MatrikkelenhetDraft = {
  kommunenummer: string;
  gardsnummer: number;
  // null på bruksnummer flytter hele gårdsnummeret.
  bruksnummer: number | null;
  teigIder: number[];
};

export type GrensejusteringDraft = {
  fraKommunenummer: string;
  tilKommunenummer: string;
  matrikkelenheter: MatrikkelenhetDraft[];
};

export type OpprettReguleringRequest = {
  navn: string;
  dato: string;
  grensejustering: GrensejusteringDraft;
};

export type ReguleringSummary = {
  id: number;
  navn: string;
  dato: string;
  fraKommunenummer: string;
  tilKommunenummer: string;
};

export type ReguleringDetail = {
  id: number;
  navn: string;
  dato: string;
  grensejustering: GrensejusteringDraft;
};

// Teiger uten matrikkelnummer returnerer null
export function lagMatrikkelenhetDraft(enhet: Matrikkelenhet): MatrikkelenhetDraft | null {
  if (
    !enhet.matrikkelnummer ||
    enhet.matrikkelnummer.gardsnummer === null ||
    enhet.matrikkelnummer.bruksnummer === null
  )
    return null;
  return {
    kommunenummer: enhet.matrikkelnummer?.kommunenummer,
    gardsnummer: enhet.matrikkelnummer?.gardsnummer,
    bruksnummer: enhet.matrikkelnummer?.bruksnummer,
    teigIder: enhet.features.map((teig) => teig.properties.lokalid),
  };
}

export function gardsnummerNokkel({ kommunenummer, gardsnummer }: MatrikkelenhetDraft): string {
  return `${kommunenummer}-${gardsnummer}`;
}

export function medHeleGardsnummer(
  matrikkelenheter: MatrikkelenhetDraft[],
  heleGardsnummer: ReadonlySet<string>,
): MatrikkelenhetDraft[] {
  const result: MatrikkelenhetDraft[] = [];
  const gardene = new Map<string, MatrikkelenhetDraft>();
  for (const enhet of matrikkelenheter) {
    const nokkel = gardsnummerNokkel(enhet);
    if (!heleGardsnummer.has(nokkel)) {
      result.push(enhet);
      continue;
    }
    const gard = gardene.get(nokkel);
    if (gard) {
      gard.teigIder.push(...enhet.teigIder);
    } else {
      const helGard = { ...enhet, bruksnummer: null, teigIder: [...enhet.teigIder] };
      gardene.set(nokkel, helGard);
      result.push(helGard);
    }
  }
  return result;
}

export function formatMatrikkelnummer(matrikkelenhet: MatrikkelenhetDraft): string {
  const { kommunenummer, gardsnummer, bruksnummer } = matrikkelenhet;
  if (bruksnummer === null) return `${kommunenummer}-${gardsnummer} (hele gårdsnummeret)`;
  return `${kommunenummer}-${gardsnummer}/${bruksnummer}`;
}

const KOMMUNENUMMER = /^\d{4}$/;

export function validerGrensejustering(grensejustering: GrensejusteringDraft): string | null {
  const { fraKommunenummer, tilKommunenummer, matrikkelenheter } = grensejustering;
  if (!KOMMUNENUMMER.test(fraKommunenummer))
    return "Fra kommune må være et firesifret kommunenummer";
  if (!KOMMUNENUMMER.test(tilKommunenummer))
    return "Til kommune må være et firesifret kommunenummer";
  if (fraKommunenummer === tilKommunenummer) return "Fra og til kommune må være forskjellige";
  if (matrikkelenheter.some((item) => item.kommunenummer !== fraKommunenummer)) {
    return "Alle valgte matrikkelenheter må ligge i fra kommune";
  }
  return null;
}
