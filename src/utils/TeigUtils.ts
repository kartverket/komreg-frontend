import { Polygon, type Geometry } from "ol/geom";
import WFS from "ol/format/WFS";
import { and, equalTo, within } from "ol/format/filter";
import type Filter from "ol/format/filter/Filter";
import type { Feature } from "ol";
import type { Coordinate } from "ol/coordinate";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";
import { transform } from "ol/proj";
import type { Teig } from "@/types/TeigResponse";
import type { Address } from "@/types/Address";
import type { Matrikkelnummer } from "@/domain/regulering";

type ReguleringApiAddress = {
  type: "Feature";
  id: number;
  featureType: "Address";
  geometry: { type: "Point"; coordinates: Coordinate };
  properties: {
    municipalityNumber: string;
    addressCode: number;
    addressName: string;
    addressNumber: number;
    addressNumberExtension: string | null;
  };
};

type ReguleringApiParcel = {
  type: "Feature";
  id: number;
  featureType: "Parcel";
  geometry: { type: "Polygon"; coordinates: Coordinate[][] };
  properties: {
    cadastralNumbers: {
      municipalityNumber: string;
      landNumber: number;
      titleNumber: number;
    }[];
    // Satt av /point/cadestral_unit: teigen som dekker punktet det ble klikket i.
    coveringParcel?: boolean;
    // Satt av /krets/{id}/cadastral_unit: false for teiger som ligger utenfor kretsen, men er
    // med fordi de deler matrikkelenhet med en teig innenfor.
    inKrets?: boolean;
  };
};

export type ReguleringApiGrunnkrets = {
  type: "Feature";
  id: number;
  featureType: "Krets";
  geometry: { type: "MultiPolygon"; coordinates: Coordinate[][][] };
  properties: {
    municipalityNumber: string;
    kretsnummer: number;
    kretsnavn: string;
  };
};

export type ReguleringApiResponse = {
  type: "FeatureCollection";
  features: (ReguleringApiAddress | ReguleringApiParcel)[];
  crs: { type: "name"; properties: { name: string } };
};

export async function getMatrikkelenheterConnectedToTeigAtPoint(
  coordinates: Coordinate,
): Promise<Matrikkelenhet[]> {
  const utm33Coordinates = utm33(coordinates);

  const url = new URL(`/api/regulering/point/cadestral_unit`, window.location.origin);
  url.searchParams.append("easting", String(utm33Coordinates[0]));
  url.searchParams.append("northing", String(utm33Coordinates[1]));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API call failed with status: ${res.status}`);
  }

  const cadastralUnitsConnectedToParcel = (await res.json()) as ReguleringApiResponse;
  const matrikkelenheter = reguleringApiToMatrikkelEnhet(cadastralUnitsConnectedToParcel);

  //populate connectedToOtherUnits for each matrikkelenhet
  //All the matrikkelenheter returned here should be connected to each other
  for (const enhet of matrikkelenheter) {
    enhet.connectedToOtherUnits = matrikkelenheter
      .filter((otherEnhet) => otherEnhet.id !== enhet.id)
      .map((otherEnhet) => otherEnhet.id);
  }
  return matrikkelenheter;
}

function utm33(coordinates: Coordinate): Coordinate {
  return transform(coordinates, "EPSG:3857", "EPSG:32633");
}

/** Grunnkretsen som dekker punktet, eller undefined når punktet ikke ligger i noen. */
export async function getGrunnkretsAtPoint(
  coordinates: Coordinate,
): Promise<ReguleringApiGrunnkrets | undefined> {
  const [easting, northing] = utm33(coordinates);
  const url = new URL(`/api/regulering/point/krets`, window.location.origin);
  url.searchParams.append("easting", String(easting));
  url.searchParams.append("northing", String(northing));

  const res = await fetch(url);
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`API call failed with status: ${res.status}`);
  }
  return (await res.json()) as ReguleringApiGrunnkrets;
}

/**
 * Matrikkelenhetene med teig i grunnkretsen. Enheter som deler en teig hører sammen, så de
 * kobles slik at de fjernes samlet.
 */
export async function getMatrikkelenheterInGrunnkrets(kretsId: number): Promise<Matrikkelenhet[]> {
  const res = await fetch(
    new URL(`/api/regulering/krets/${kretsId}/cadastral_unit`, window.location.origin),
  );
  if (!res.ok) {
    throw new Error(`API call failed with status: ${res.status}`);
  }
  const matrikkelenheter = reguleringApiToMatrikkelEnhet(
    (await res.json()) as ReguleringApiResponse,
  );
  connectUnitsSharingTeig(matrikkelenheter);
  return matrikkelenheter;
}

function connectUnitsSharingTeig(matrikkelenheter: Matrikkelenhet[]) {
  const unitIdsByTeig = new Map<number, string[]>();
  for (const enhet of matrikkelenheter) {
    for (const teig of enhet.features) {
      const unitIds = unitIdsByTeig.get(teig.properties.lokalid) ?? [];
      unitIds.push(enhet.id);
      unitIdsByTeig.set(teig.properties.lokalid, unitIds);
    }
  }

  const unitsById = new Map(matrikkelenheter.map((enhet) => [enhet.id, enhet]));
  const grouped = new Set<string>();
  for (const start of matrikkelenheter) {
    if (grouped.has(start.id)) continue;
    // Alle enheter som kan nås fra start gjennom delte teiger
    const group = [start.id];
    grouped.add(start.id);
    for (const unitId of group) {
      for (const teig of unitsById.get(unitId)?.features ?? []) {
        for (const neighbourId of unitIdsByTeig.get(teig.properties.lokalid) ?? []) {
          if (grouped.has(neighbourId)) continue;
          grouped.add(neighbourId);
          group.push(neighbourId);
        }
      }
    }
    for (const unitId of group) {
      const enhet = unitsById.get(unitId);
      if (enhet) enhet.connectedToOtherUnits = group.filter((otherId) => otherId !== unitId);
    }
  }
}
export async function fetchTeigerInGeometry(geometry: Geometry): Promise<Teig[]> {
  const features = await fetchTeigFeatures(within("representasjonspunkt", geometry, "EPSG:3857"));
  return features.map(teigFeatureToTeigResponse).filter((teig) => teig !== undefined);
}

async function fetchTeigFeatures(filter: Filter, count?: number): Promise<Feature[]> {
  const wfsFormat = new WFS({ version: "2.0.0" });
  const node = wfsFormat.writeGetFeature({
    srsName: "EPSG:3857",
    featurePrefix: "app",
    featureTypes: ["Teig"],
    featureNS:
      "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Eiendomskart-Teig/20211101",
    filter,
    count,
  });
  const res = await fetch("https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: new XMLSerializer().serializeToString(node),
  });
  if (!res.ok) {
    throw new Error(`WFS request failed with status ${res.status}`);
  }

  const text = await res.text();

  if (!text) {
    throw new Error("WFS response is empty");
  }
  return wfsFormat.readFeatures(text);
}

export function teigFeatureToTeigResponse(feature: Feature): Teig | undefined {
  const geometry = feature.getGeometry();
  if (!(geometry instanceof Polygon)) {
    console.error("Teig has unexpected geometry type", feature.getId());
    return undefined;
  }

  // gml:id has the form "teig.<teigId>" – teigId doubles as the lokalid.
  const lokalid = Number(feature.getId()?.toString().split(".").at(1));
  if (Number.isNaN(lokalid)) {
    console.error("Could not parse teig lokalid from", feature.getId());
    return undefined;
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: geometry.getCoordinates(),
    },
    properties: {
      lokalid,
    },
  };
}

// Eiendoms-API-et (og Teig-WFS-en) kjenner bare matrikkelenheter som har teig. Et nummer som
// ikke finnes her er derfor ikke et bevis på at det er ledig, men et som finnes er opptatt.
async function bruksnummerFinnes(
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number,
): Promise<boolean> {
  const url = `https://api.kartverket.no/eiendom/v1/geokoding?kommunenummer=${kommunenummer}&gardsnummer=${gardsnummer}&bruksnummer=${bruksnummer}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kartverket API returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { features?: unknown[] };
  return (data.features?.length ?? 0) > 0;
}

// Geokodingen krever bruksnummer, så et helt gårdsnummer slås opp i Teig-WFS-en. Én teig
// holder for å vite at gårdsnummeret er i bruk.
async function gardsnummerFinnes(kommunenummer: string, gardsnummer: number): Promise<boolean> {
  const sti = "app:matrikkelenhet/app:Matrikkelenhet";
  const filter = and(
    equalTo(`${sti}/app:kommunenummer`, kommunenummer),
    equalTo(`${sti}/app:gardsnummer`, gardsnummer),
  );
  return (await fetchTeigFeatures(filter, 1)).length > 0;
}

export function matrikkelnummerFinnes(
  kommunenummer: string,
  { gardsnummer, bruksnummer }: Matrikkelnummer,
): Promise<boolean> {
  return bruksnummer === null
    ? gardsnummerFinnes(kommunenummer, gardsnummer)
    : bruksnummerFinnes(kommunenummer, gardsnummer, bruksnummer);
}

const SAMTIDIGE_OPPSLAG = 6;

export async function finnEksisterendeMatrikkelnumre(
  kommunenummer: string,
  matrikkelnumre: Matrikkelnummer[],
): Promise<Matrikkelnummer[]> {
  const eksisterende: Matrikkelnummer[] = [];
  for (let i = 0; i < matrikkelnumre.length; i += SAMTIDIGE_OPPSLAG) {
    const bolk = matrikkelnumre.slice(i, i + SAMTIDIGE_OPPSLAG);
    const finnes = await Promise.all(
      bolk.map((nummer) => matrikkelnummerFinnes(kommunenummer, nummer)),
    );
    eksisterende.push(...bolk.filter((_, index) => finnes[index]));
  }
  return eksisterende;
}

function reguleringApiToMatrikkelEnhet(input: ReguleringApiResponse): Matrikkelenhet[] {
  const teiger = input.features.filter((feature) => feature.featureType === "Parcel");
  const addresser = input.features.filter((feature) => feature.featureType === "Address");
  const matrikkelenheter = new Map<string, Matrikkelenhet>();
  // Gnr 0 means the teig has no matrikkelnummer (bnr 0: "Mnr mangler", bnr 1: "Mnr mangler vann").
  // Every such teig in a kommune shares the same cadastral number, so they get an id per teig.
  function buildCadNumber(
    cadastralNumber: {
      municipalityNumber: string;
      landNumber: number;
      titleNumber: number;
    },
    teigId: number,
  ) {
    if (cadastralNumber.landNumber === 0) return `teig/${teigId}`;
    return `${cadastralNumber.municipalityNumber}/${cadastralNumber.landNumber}/${cadastralNumber.titleNumber}`;
  }

  const flat = teiger.flatMap((teig) =>
    teig.properties.cadastralNumbers.map((cadastralNumber) => ({ cadastralNumber, teig })),
  );

  for (const teig of flat) {
    const id = buildCadNumber(teig.cadastralNumber, teig.teig.id);
    const enhet = matrikkelenheter.get(id);
    if (enhet) {
      enhet.features.push(reguleringApiParcelToTeigResponse(teig.teig));
      continue;
    }
    matrikkelenheter.set(id, {
      id,
      features: [reguleringApiParcelToTeigResponse(teig.teig)],
      matrikkelnummer: {
        kommunenummer: teig.cadastralNumber.municipalityNumber,
        gardsnummer: teig.cadastralNumber.landNumber,
        bruksnummer: teig.cadastralNumber.titleNumber,
      },
    });
  }

  const matrikkelenheterArray = Array.from(matrikkelenheter.values());

  //add the addresses to the first matrikkelenhet, does not matter
  if (matrikkelenheterArray.length > 0 && matrikkelenheterArray[0] != null) {
    matrikkelenheterArray[0].addresses = addresser.map((address): Address => {
      const [lon, lat] = address.geometry.coordinates;
      return {
        adressenavn: address.properties.addressName,
        adressekode: address.properties.addressCode,
        nummer: address.properties.addressNumber,
        bokstav: address.properties.addressNumberExtension ?? undefined,
        adressetekst:
          `${address.properties.addressName} ${address.properties.addressNumber} ${address.properties.addressNumberExtension ?? ""}`.trim(),
        kommunenummer: address.properties.municipalityNumber,
        representasjonspunkt:
          lat !== undefined && lon !== undefined
            ? {
                epsg: "32633",
                lat: lat,
                lon: lon,
              }
            : undefined,
      };
    });
  }

  return matrikkelenheterArray;
}

function reguleringApiParcelToTeigResponse(input: ReguleringApiParcel): Teig {
  return {
    geometry: input.geometry,
    type: input.type,
    properties: {
      lokalid: input.id,
      inKrets: input.properties.inKrets,
    },
  };
}
