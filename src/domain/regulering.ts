export type MatrikkelenhetDraft = {
  kommunenummer: string;
  gardsnummer: number;
  // null på bruksnummer flytter hele gårdsnummeret.
  bruksnummer: number | null;
  teigIder: number[];
  // Undefined beholder dagens nummer.
  nyGardsnummer?: number;
  nyBruksnummer?: number;
};

// Det brukeren har tastet inn, før det tolkes som tall.
export type NyttMatrikkelnummerInput = {
  gardsnummer: string;
  bruksnummer: string;
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

function tilNummer(verdi: string | undefined): number | undefined {
  const trimmet = verdi?.trim();
  return trimmet ? Number(trimmet) : undefined;
}

// Nøkkelen er formatMatrikkelnummer, så verdiene følger enheten når hele gårdsnummer slås av og på.
// Bruksnummer ignoreres når hele gårdsnummeret flyttes, siden alle bruksnumrene da beholdes.
export function medNyeMatrikkelnumre(
  matrikkelenheter: MatrikkelenhetDraft[],
  nyeNumre: ReadonlyMap<string, NyttMatrikkelnummerInput>,
): MatrikkelenhetDraft[] {
  return matrikkelenheter.map((enhet) => {
    const input = nyeNumre.get(formatMatrikkelnummer(enhet));
    const nyGardsnummer = tilNummer(input?.gardsnummer);
    const nyBruksnummer = enhet.bruksnummer === null ? undefined : tilNummer(input?.bruksnummer);
    return {
      ...enhet,
      ...(nyGardsnummer !== undefined && { nyGardsnummer }),
      ...(nyBruksnummer !== undefined && { nyBruksnummer }),
    };
  });
}

export type Matrikkelnummer = {
  gardsnummer: number;
  // null er hele gårdsnummeret.
  bruksnummer: number | null;
};

export function nyttMatrikkelnummer(enhet: MatrikkelenhetDraft): Matrikkelnummer {
  return {
    gardsnummer: enhet.nyGardsnummer ?? enhet.gardsnummer,
    bruksnummer: enhet.bruksnummer === null ? null : (enhet.nyBruksnummer ?? enhet.bruksnummer),
  };
}

export function harNyttMatrikkelnummer(enhet: MatrikkelenhetDraft): boolean {
  return enhet.nyGardsnummer !== undefined || enhet.nyBruksnummer !== undefined;
}

export function formatNyttMatrikkelnummer(enhet: MatrikkelenhetDraft): string {
  if (!harNyttMatrikkelnummer(enhet)) return "Uendret";
  return formatNummer(nyttMatrikkelnummer(enhet));
}

function gyldigNummer(nummer: number | undefined): boolean {
  return nummer === undefined || (Number.isInteger(nummer) && nummer > 0);
}

function formatNummer({ gardsnummer, bruksnummer }: Matrikkelnummer) {
  return bruksnummer === null ? `${gardsnummer}` : `${gardsnummer}/${bruksnummer}`;
}

// Finner to enheter i reguleringen som havner på samme nummer i til kommune. Et helt
// gårdsnummer tar med seg bruksnumre vi ikke kjenner, så alt annet som havner på samme
// gårdsnummer regnes som kollisjon.
function forsteKollisjonNyeMatrikkelnummer(matrikkelenheter: MatrikkelenhetDraft[]): string | null {
  const heleGarder = new Set<number>();
  const brukteGarder = new Set<number>();
  const enheter = new Set<string>();
  for (const enhet of matrikkelenheter) {
    const nytt = nyttMatrikkelnummer(enhet);
    const nokkel = formatNummer(nytt);
    if (nytt.bruksnummer === null) {
      if (brukteGarder.has(nytt.gardsnummer)) return nokkel;
      heleGarder.add(nytt.gardsnummer);
    } else {
      if (heleGarder.has(nytt.gardsnummer) || enheter.has(nokkel)) return nokkel;
      enheter.add(nokkel);
    }
    brukteGarder.add(nytt.gardsnummer);
  }
  return null;
}

export function matrikkelnumreITilKommune(
  matrikkelenheter: MatrikkelenhetDraft[],
): Matrikkelnummer[] {
  const numre = new Map<string, Matrikkelnummer>();
  for (const enhet of matrikkelenheter) {
    const nytt = nyttMatrikkelnummer(enhet);
    numre.set(formatNummer(nytt), nytt);
  }
  return [...numre.values()];
}

export function finnOpptattMatrikkelnummer(
  matrikkelenheter: MatrikkelenhetDraft[],
  tilKommunenummer: string,
  eksisterende: Matrikkelnummer[],
): string | null {
  const opptatte = new Set(eksisterende.map(formatNummer));
  for (const enhet of matrikkelenheter) {
    const nytt = formatNummer(nyttMatrikkelnummer(enhet));
    if (opptatte.has(nytt)) {
      return `${formatMatrikkelnummer(enhet)} får ${nytt}, som allerede finnes i ${tilKommunenummer}. Velg et annet nytt matrikkelnummer.`;
    }
  }
  return null;
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
  const ugyldig = matrikkelenheter.find(
    (item) => !gyldigNummer(item.nyGardsnummer) || !gyldigNummer(item.nyBruksnummer),
  );
  if (ugyldig) {
    return `Nytt matrikkelnummer for ${formatMatrikkelnummer(ugyldig)} må være positive heltall`;
  }
  const kollisjon = forsteKollisjonNyeMatrikkelnummer(matrikkelenheter);
  if (kollisjon) return `Flere matrikkelenheter får matrikkelnummer ${kollisjon} i til kommune`;
  return null;
}
