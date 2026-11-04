import type { Coordinate } from "ol/coordinate";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";
import { transform } from "ol/proj";
import type { Teig } from "@/types/TeigResponse";
import type { Address } from "@/types/Address";

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
    coveringParcel: boolean;
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
  //convert coordinates to utm33
  const utm33Coordinates = transform(coordinates, "EPSG:3857", "EPSG:32633");

  //TODO: Route the calls through caddy
  const url = new URL(`http://localhost:8082/point/cadestral_unit`);
  url.searchParams.append("easting", String(utm33Coordinates[0]));
  url.searchParams.append("northing", String(utm33Coordinates[1]));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API call failed with status: ${res.status}`);
  }
  const cadastralUnitsConnectedToParcel = (await res.json()) as ReguleringApiResponse;
  return reguleringApiToMatrikkelEnhet(cadastralUnitsConnectedToParcel);
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

  //populate connectedToOtherUnits for each matrikkelenhet
  //All the matrikkelenheter returned here should be connected to each other
  for (const enhet of matrikkelenheterArray) {
    enhet.connectedToOtherUnits = matrikkelenheterArray
      .filter((otherEnhet) => otherEnhet.id !== enhet.id)
      .map((otherEnhet) => otherEnhet.id);
  }

  return matrikkelenheterArray;
}

function reguleringApiParcelToTeigResponse(input: ReguleringApiParcel): Teig {
  return {
    geometry: input.geometry,
    type: input.type,
    properties: {
      lokalid: input.id,
    },
  };
}
