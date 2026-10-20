import { type Geometry } from "ol/geom";
import type { TeigResponse } from "@/types/TeigResponse";
import WFS from "ol/format/WFS";
import { within } from "ol/format/filter";
import type { Feature } from "ol";
import Polygon from "ol/geom/Polygon";
import type { Coordinate } from "ol/coordinate";
import { fetchGrunnkretsAtPoint } from "@/utils/GrunnkretsUtils";

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
    featureTypes: ["app:Teig"],
    featureNS:
      "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Eiendomskart-Teig/20211101",
    featurePrefix: "app",
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

function teigFeatureToTeigResponse(feature: Feature): TeigResponse | undefined {
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
      bruksnummer: Number(props.bruksnummer) || 0,
      festenummer: Number(props.festenummer) || 0,
      gardsnummer: Number(props.gardsnummer) || 0,
      hovedområde: true,
      kommunenummer: String(props.kommunenummer ?? ""),
      lokalid,
      matrikkelnummertekst: String(props.matrikkelnummerTekst ?? ""),
      meterFraPunkt: 0,
      nøyaktighetsklasseteig: String(props.noyaktighetsklasseTeig ?? ""),
      objekttype: "Teig",
      oppdateringsdato: String(props.oppdateringsdato ?? ""),
      seksjonsnummer: Number(props.seksjonsnummer) || 0,
      teigmedflerematrikkelenheter: Boolean(props.teigMedFlereMatrikkelenheter),
      uregistrertjordsameie: Boolean(props.uregistrertJordsameie),
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
