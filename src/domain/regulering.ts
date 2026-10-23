export type MatrikkelenhetDraft = {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  festenummer: number;
  seksjonsnummer: number;
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
  antallMatrikkelenheter: number;
};

export type ReguleringDetail = {
  id: number;
  navn: string;
  dato: string;
  grensejustering: GrensejusteringDraft;
};

export type TeigForRegulering = {
  properties: {
    kommunenummer: string;
    gardsnummer: number;
    bruksnummer: number;
    festenummer: number;
    seksjonsnummer: number | null;
    lokalid: number;
  };
};

export function lagMatrikkelenheterFraTeiger(
  teiger: Iterable<TeigForRegulering>,
): MatrikkelenhetDraft[] {
  const grouped = new Map<string, MatrikkelenhetDraft>();
  for (const teig of teiger) {
    const properties = teig.properties;
    // Teiger without a seksjon come with null; the matrikkel uses 0.
    const seksjonsnummer = properties.seksjonsnummer ?? 0;
    const key = [
      properties.kommunenummer,
      properties.gardsnummer,
      properties.bruksnummer,
      properties.festenummer,
      seksjonsnummer,
    ].join("/");
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.teigIder.includes(properties.lokalid)) {
        existing.teigIder.push(properties.lokalid);
      }
    } else {
      grouped.set(key, {
        kommunenummer: properties.kommunenummer,
        gardsnummer: properties.gardsnummer,
        bruksnummer: properties.bruksnummer,
        festenummer: properties.festenummer,
        seksjonsnummer,
        teigIder: [properties.lokalid],
      });
    }
  }
  return Array.from(grouped.values());
}

export function formatMatrikkelnummer(matrikkelenhet: MatrikkelenhetDraft): string {
  const { kommunenummer, gardsnummer, bruksnummer, festenummer, seksjonsnummer } = matrikkelenhet;
  const nummer = [gardsnummer, bruksnummer, festenummer, seksjonsnummer];
  while (nummer.length > 2 && nummer.at(-1) === 0) nummer.pop();
  return `${kommunenummer}-${nummer.join("/")}`;
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
