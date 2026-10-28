export type MatrikkelenhetDraft = {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  // The teiger selected in the map.
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

export function formatMatrikkelnummer(matrikkelenhet: MatrikkelenhetDraft): string {
  const { kommunenummer, gardsnummer, bruksnummer } = matrikkelenhet;
  return `${kommunenummer}-${gardsnummer}/${bruksnummer}`;
}
