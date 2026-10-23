import { type Geometry } from "ol/geom";
import type { TeigResponse } from "@/types/TeigResponse";
import WFS from "ol/format/WFS";
import { within } from "ol/format/filter";
import type { Feature } from "ol";
import Polygon from "ol/geom/Polygon";
import type { Coordinate } from "ol/coordinate";
import { fetchGrunnkretsAtPoint } from "@/utils/GrunnkretsUtils";
import type { MatrikkelenhetResponse } from "@/types/Matrikkelenhet";

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

export async function getMatrikkelenhetAtPoint(
  coordinates: Coordinate,
): Promise<MatrikkelenhetResponse | undefined> {
  const teig = await fetchTeigAtPoint(coordinates);
  if (!teig) {
    return undefined;
  }
  const kommunnenummer = teig.properties.kommunenummer;
  const gardsnummer = teig.properties.gardsnummer;
  const bruksnummer = teig.properties.bruksnummer;

  const matrikkelenhet = await getAllTeigerForMatrikkelenhet(
    kommunnenummer,
    gardsnummer,
    bruksnummer,
  );

  if (!matrikkelenhet.features || matrikkelenhet.features.length === 0) return undefined;
  return { id: kommunnenummer + "-" + gardsnummer + "-" + bruksnummer, ...matrikkelenhet };
}

function getAllTeigerForMatrikkelenhet(
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number,
): Promise<Omit<MatrikkelenhetResponse, "id">> {
  const url = `https://api.kartverket.no/eiendom/v1/geokoding?kommunenummer=${kommunenummer}&gardsnummer=${gardsnummer}&bruksnummer=${bruksnummer}&omrade=true&utkoordsys=3857`;
  return fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Kartverket API returned HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data: Omit<MatrikkelenhetResponse, "id">) => data);
}
