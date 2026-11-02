import { type Geometry } from "ol/geom";
import type { TeigResponse } from "@/types/TeigResponse";
import WFS from "ol/format/WFS";
import { within } from "ol/format/filter";
import type { Feature } from "ol";
import Polygon from "ol/geom/Polygon";
import type { Coordinate } from "ol/coordinate";
import { fetchGrunnkretsAtPoint } from "@/utils/GrunnkretsUtils";
import type { MatrikkelenhetResponse } from "@/types/Matrikkelenhet";
import type { Address } from "@/types/Address";
import { transform } from "ol/proj";

export async function getAllTeigerInGrunnkretsAtPoint(
  coordinate: Coordinate,
): Promise<TeigResponse[]> {
  try {
    const grunnkrets = await fetchGrunnkretsAtPoint(coordinate);
    const grunnkretsGeometry = grunnkrets.getGeometry();

    if (!grunnkretsGeometry) {
      console.error("Grunnkrets has no geometry", grunnkrets.getId());
      return [];
    }

    const teigerFraGrunnkrets = await fetchTeigerInGeometry(grunnkretsGeometry);
    return teigerFraGrunnkrets;
  } catch (error) {
    console.error("Failed to get teiger in grunnkrets at point", error);
    return [];
  }
}

export async function fetchTeigerInGeometry(geometry: Geometry): Promise<TeigResponse[]> {
  const wfsFormat = new WFS({ version: "2.0.0" });
  const node = wfsFormat.writeGetFeature({
    srsName: "EPSG:3857",
    featurePrefix: "app",
    featureTypes: ["Teig"],
    featureNS:
      "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Eiendomskart-Teig/20211101",
    filter: within("representasjonspunkt", geometry, "EPSG:3857"),
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
  const features = wfsFormat.readFeatures(text);
  return features.map(teigFeatureToTeigResponse).filter((teig) => teig !== undefined);
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

export function teigFeatureToTeigResponse(feature: Feature): TeigResponse | undefined {
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

  const props = feature.getProperties();

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: geometry.getCoordinates(),
    },
    properties: {
      bruksnummer: Number(props.matrikkelenhet?.Matrikkelenhet?.bruksnummer) || 0,
      festenummer: Number(props.festenummer) || 0,
      gardsnummer: Number(props.matrikkelenhet?.Matrikkelenhet?.gardsnummer) || 0,
      hovedområde: true,
      kommunenummer: String(props.kommunenummer ?? ""),
      lokalid,
      matrikkelnummertekst: String(props.matrikkelnummerTekst ?? ""),
      meterFraPunkt: 0,
      nøyaktighetsklasseteig: String(props.noyaktighetsklasseTeig ?? ""),
      objekttype: "Teig",
      oppdateringsdato: String(props.oppdateringsdato ?? ""),
      seksjonsnummer: props.seksjonsnummer !== undefined ? Number(props.seksjonsnummer) : null,
      teigmedflerematrikkelenheter: parseBoolean(props.teigMedFlereMatrikkelenheter),
      uregistrertjordsameie: parseBoolean(props.uregistrertJordsameie),
    },
  };
}

export async function fetchTeigAtPoint(coordinates: Coordinate): Promise<TeigResponse | undefined> {
  const url = `https://api.kartverket.no/eiendom/v1/punkt/omrader?ost=${coordinates[0]}&nord=${coordinates[1]}&koordsys=3857&utkoordsys=3857`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kartverket API returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { crs: unknown; features: TeigResponse[] };
  if (!data.features || data.features.length === 0) {
    return undefined;
  }
  return data.features.at(0);
}

export async function getMatrikkelenheterConnectedToTeigAtPoint(
  coordinates: Coordinate,
): Promise<MatrikkelenhetResponse[] | undefined> {
  //convert coordinates to utm33
  const utm33Coordinates = transform(coordinates, "EPSG:3857", "EPSG:32633");

  const url = new URL(`http://localhost:8082/point/cadestral_unit`);
  url.searchParams.append("easting", String(utm33Coordinates[0]));
  url.searchParams.append("northing", String(utm33Coordinates[1]));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Local API returned HTTP ${res.status}`);
  }
  const cadastralUnitsConnectedToParcel = (await res.json()) as {
    coveringParcelId: number;
    cadestralUnits: {
      id: number;
      cadastralNumber: { municipalityNumber: string; landNumber: number; titleNumber: number };
      mainParcelId: number;
      otherParcelIds: number[];
    }[];
    features: {
      type: "FeatureCollection";
      features: TeigResponse[];
    };
  };

  //convert all features from utm33 to 3857
  cadastralUnitsConnectedToParcel.features.features.forEach((feature) => {
    feature.geometry.coordinates = feature.geometry.coordinates.map((ring) =>
      ring.map((coord) => transform(coord, "EPSG:32633", "EPSG:3857")),
    );
  });

  const matrikkelEnheterForTeig = cadastralUnitsConnectedToParcel.cadestralUnits;

  //hvis teigen er mnr mangler eller mnr mangler vann, og ikke er koblet til noen andre matrikkelenheter kan vi legge til bare den ene teigen
  if (
    matrikkelEnheterForTeig.length == 1 &&
    matrikkelEnheterForTeig[0]?.cadastralNumber.landNumber == 0 &&
    (matrikkelEnheterForTeig[0]?.cadastralNumber.titleNumber == 0 ||
      matrikkelEnheterForTeig[0]?.cadastralNumber.titleNumber == 1)
  ) {
    //TODO: return teig alone
    console.log("Teig er mnr mangler eller mnr mangler vann");
    return;
  }

  const matrikkelenheter: MatrikkelenhetResponse[] = matrikkelEnheterForTeig.map(
    (matrikkelenhet) => ({
      id: String(matrikkelenhet.id),
      connectedToOtherUnits: matrikkelEnheterForTeig
        .filter((m) => m.id !== matrikkelenhet.id)
        .map((m) => String(m.id)),
      matrikkelnummer: {
        kommunenummer: matrikkelenhet.cadastralNumber.municipalityNumber,
        gardsnummer: matrikkelenhet.cadastralNumber.landNumber,
        bruksnummer: matrikkelenhet.cadastralNumber.titleNumber,
      },
      addresses: [], //TODO: Get addresses from matrikkelenhet
      features: cadastralUnitsConnectedToParcel.features.features.filter(
        (feature) =>
          matrikkelenhet.mainParcelId === feature.properties.parcelId ||
          matrikkelenhet.otherParcelIds.includes(feature.properties.parcelId),
      ),
    }),
  );
  return matrikkelenheter;
}
