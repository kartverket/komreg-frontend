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

function MapClickInteraction() {
  const map = useMap();
  const { addTeig, removeTeig, teiger } = useTeiger();

  async function handleMapClick(e: MapBrowserEvent) {
    const data = await fetchGeoJSON(e.coordinate);
    if (!data) {
      console.log("No features found at clicked location");
      return;
    }

    if (teiger.has(data.properties.lokalid)) {
      removeTeig(data.properties.lokalid);
      return;
    }

    addTeig(data.properties.lokalid, data);
  }

  useEffect(() => {
    map.on("click", handleMapClick);
    return () => {
      map.un("click", handleMapClick);
    };
  });

  return null;
}

async function fetchGeoJSON(coordinates: Coordinate): Promise<EiendomResponse | undefined> {
  const url = `https://api.kartverket.no/eiendom/v1/punkt/omrader?ost=${coordinates[0]}&nord=${coordinates[1]}&koordsys=3857&utkoordsys=3857`;
  const res = await fetch(url);
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
