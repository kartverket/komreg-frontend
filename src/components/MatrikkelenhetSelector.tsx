import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "./ToggleButton/ToggleButton";
import { NotePencilDashIcon } from "@navikt/aksel-icons";
import { useEffect } from "react";
import { useMap } from "./Map/MapContext";
import { Feature, type MapBrowserEvent } from "ol";
import type { Coordinate } from "ol/coordinate";
import Fill from "ol/style/Fill";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Polygon from "ol/geom/Polygon";
import { VectorLayer } from "./Map/VectorLayer";
import { useVectorSource } from "./Map/VectorLayerContext";
import { useTeiger } from "@/hooks/useTeiger";
import WFS from "ol/format/WFS";
import Point from "ol/geom/Point";
import { intersects, within } from "ol/format/filter";

export type EiendomResponse = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  properties: {
    bruksnummer: number;
    festenummer: number;
    gardsnummer: number;
    hovedområde: boolean;
    kommunenummer: string;
    lokalid: number;
    matrikkelnummertekst: string;
    meterFraPunkt: number;
    nøyaktighetsklasseteig: string;
    objekttype: string;
    oppdateringsdato: string;
    seksjonsnummer: number;
    teigmedflerematrikkelenheter: boolean;
    uregistrertjordsameie: boolean;
  };
};

const matrikkelenhetLayerStyle = new Style({
  fill: new Fill({ color: "rgba(26,131,59,0.2)" }),
  stroke: new Stroke({ color: "#1a833b", width: 3 }),
});

export function MatrikkelenhetSelector({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  const { teiger } = useTeiger();
  return (
    <>
      <Tooltip content={`Skru ${isActive ? "av" : "på"} henting av matrikkelenheter`}>
        <ToggleButton isActive={isActive} onToggle={onToggle}>
          <NotePencilDashIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      <VectorLayer style={matrikkelenhetLayerStyle}>
        {isActive && <MapClickInteraction />}
        {Array.from(teiger.values()).map((teig) => (
          <Teig key={teig.properties.lokalid} geometry={teig.geometry} />
        ))}
      </VectorLayer>
    </>
  );
}
function checkIfCoordinateIntersectsPolygon(
  coordinate: Coordinate,
  polygonCoordinates: Coordinate[][],
): boolean {
  return new Polygon(polygonCoordinates).intersectsCoordinate(coordinate);
}

function MapClickInteraction() {
  const map = useMap();

  useEffect(() => {
    let active = true;

    async function handleMapClick(e: MapBrowserEvent) {
      //detect shift key was pressed while clicking. e.shiftKey does not exist
      console.log(e);
      if (e.originalEvent?.shiftKey) {
        console.log("Shift key pressed during map click");
        const wfsUrl = "https://wfs.geonorge.no/skwms1/wfs.grunnkretser";

        const wfsFormat = new WFS({ version: "2.0.0" });

        const point = new Point(e.coordinate);

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
          console.error(`WFS request failed with status ${res.status}`);
          return;
        }
        const features = wfsFormat.readFeatures(await res.text());

        const grunnkrets = features.at(0);
        const grunnkretsGeometry = grunnkrets?.getGeometry();
        if (!grunnkrets || !grunnkretsGeometry) {
          console.error("No grunnkrets found for the clicked point");
          return;
        }

        const node2 = wfsFormat.writeGetFeature({
          srsName: "EPSG:3857",
          featureTypes: ["app:Teig"],
          featureNS:
            "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Eiendomskart-Teig/20211101",
          featurePrefix: "app",
          filter: within("representasjonspunkt", grunnkretsGeometry, "EPSG:3857"),
        });

        const res2 = await fetch(
          "https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig",
          {
            method: "POST",
            headers: { "Content-Type": "application/xml" },
            body: new XMLSerializer().serializeToString(node2),
          },
        );

        const features2 = wfsFormat.readFeatures(await res2.text());

        const teigerFraGrunnkrets = features2
          .map(teigFeatureToEiendomResponse)
          .filter((teig) => teig !== undefined);

        for (const teig of teigerFraGrunnkrets) {
          useTeiger.getState().addTeig(teig.properties.lokalid, teig);
        }

        return; // Skip handling the click if the control key is pressed
      }

      for (const [lokalid, teig] of useTeiger.getState().teiger) {
        if (checkIfCoordinateIntersectsPolygon(e.coordinate, teig.geometry.coordinates)) {
          useTeiger.getState().removeTeig(lokalid);
          return;
        }
      }

      let data: EiendomResponse | undefined;
      try {
        data = await fetchGeoJSON(e.coordinate);
      } catch (error) {
        console.error("Failed to retrieve matrikkelenhet", error);
        return;
      }

      if (data && active) {
        console.log(data.properties.lokalid);
        useTeiger.getState().addTeig(data.properties.lokalid, data);
      }
    }

    map.on("click", handleMapClick);
    return () => {
      active = false;
      map.un("click", handleMapClick);
    };
  }, [map]);

  return null;
}

// Normalizes a `Feature` read from the app:Teig WFS (wfs.matrikkelen-eiendomskart-teig)
// into the same shape as teiger fetched from the Kartverket REST API, so both
// sources can be rendered/stored identically.
function teigFeatureToEiendomResponse(feature: Feature): EiendomResponse | undefined {
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

async function fetchGeoJSON(coordinates: Coordinate): Promise<EiendomResponse | undefined> {
  const url = `https://api.kartverket.no/eiendom/v1/punkt/omrader?ost=${coordinates[0]}&nord=${coordinates[1]}&koordsys=3857&utkoordsys=3857`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kartverket API returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { crs: unknown; features: EiendomResponse[] };
  if (!data.features || data.features.length === 0) {
    return undefined;
  }
  return data.features.at(0);
}

function Teig({ geometry }: { geometry: EiendomResponse["geometry"] }) {
  const source = useVectorSource();
  useEffect(() => {
    const feature = new Feature({
      geometry: new Polygon(geometry.coordinates),
    });
    source.addFeature(feature);
    return () => {
      source.removeFeature(feature);
    };
  }, [geometry, source]);

  return null;
}
