import type { Coordinate } from "ol/coordinate";
import type { Feature } from "ol";
import WFS from "ol/format/WFS";
import { intersects } from "ol/format/filter";
import Point from "ol/geom/Point";

export async function fetchGrunnkretsAtPoint(coordinate: Coordinate): Promise<Feature> {
  const wfsUrl = "https://wfs.geonorge.no/skwms1/wfs.grunnkretser";

  const wfsFormat = new WFS({ version: "2.0.0" });

  const point = new Point(coordinate);

  const node = wfsFormat.writeGetFeature({
    srsName: "EPSG:3857",
    featureTypes: ["app:Grunnkrets"],
    featureNS:
      "https://skjema.geonorge.no/SOSI/produktspesifikasjon/StatEnheterGrunnkretser/20240101",
    featurePrefix: "app",
    filter: intersects("område", point, "EPSG:3857"),
  });

  const res = await fetch(wfsUrl, {
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

  if (features.length === 0) {
    throw new Error("No features found at the given point");
  }

  const closestGrunnkrets = features[0];

  if (!closestGrunnkrets) {
    throw new Error("No features found at the given point");
  }

  return closestGrunnkrets;
}
