export type MatrikkelenhetDraft = {
  kommunenummer: string;
  gardsnummer: number;
  // null: the whole gårdsnummer moves, with every bruksnummer under it.
  bruksnummer: number | null;
  // The teiger selected in the map, also for a whole gårdsnummer.
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

export type ValgtMatrikkelenhet = {
  features: {
    properties: {
      kommunenummer: string;
      gardsnummer: number | null;
      bruksnummer: number | null;
      lokalid: number;
    };
  }[];
};

// Teiger uten matrikkelnummer returnerer null
export function lagMatrikkelenhetDraft(enhet: ValgtMatrikkelenhet): MatrikkelenhetDraft | null {
  const first = enhet.features[0]?.properties;
  if (!first || first.gardsnummer === null || first.bruksnummer === null) return null;
  return {
    kommunenummer: first.kommunenummer,
    gardsnummer: first.gardsnummer,
    bruksnummer: first.bruksnummer,
    teigIder: enhet.features.map((teig) => teig.properties.lokalid),
  };
}

export function gardsnummerNokkel({ kommunenummer, gardsnummer }: MatrikkelenhetDraft): string {
  return `${kommunenummer}-${gardsnummer}`;
}

// Erstatter bruksnummer under hvert gårdsnummer i heleGardsnummer med en endring for hele gårdsnummeret.
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
