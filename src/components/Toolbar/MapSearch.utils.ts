export type SearchTarget =
  | { type: "kommune"; kommunenummer: string }
  | {
      type: "matrikkelnummer";
      kommunenummer: string;
      gardsnummer: string;
      bruksnummer: string;
      festenummer?: string;
    };

export function parseSearchTarget(value: string): SearchTarget | null {
  const query = value.trim();
  if (/^\d{4}$/.test(query)) {
    return { type: "kommune", kommunenummer: query };
  }

  const match = query.match(/^(\d{4})-(\d+)\/(\d+)(?:\/(\d+))?$/);
  if (!match) return null;
  const [, kommunenummer, gardsnummer, bruksnummer, festenummer] = match;
  if (!kommunenummer || !gardsnummer || !bruksnummer) return null;
  return { type: "matrikkelnummer", kommunenummer, gardsnummer, bruksnummer, festenummer };
}
