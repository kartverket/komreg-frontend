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
import { ToolInfoBox } from "./Toolbar/ToolInfoBox";

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
      <ToolInfoBox isActive={isActive}>
        Hold inne Cmd (Mac) eller Ctrl (Windows) og dra for å velge flere matrikkelenheter. Hold
        også Shift for å fjerne.
      </ToolInfoBox>
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
    const dragSelections: { coordinate: Coordinate; remove: boolean }[] = [];
    let isProcessingDrag = false;

    function findSelectedTeig(coordinate: Coordinate) {
      return Array.from(useTeiger.getState().teiger).find(([, teig]) =>
        checkIfCoordinateIntersectsPolygon(coordinate, teig.geometry.coordinates),
      );
    }

    async function addTeigAtCoordinate(coordinate: Coordinate) {
      let data: EiendomResponse | undefined;
      try {
        data = await fetchGeoJSON(coordinate);
      } catch (error) {
        console.error("Failed to retrieve matrikkelenhet", error);
        return;
      }

      if (data && active) {
        useTeiger.getState().addTeig(data.properties.lokalid, data);
      }
    }

    async function handleMapClick(e: MapBrowserEvent) {
      const selectedTeig = findSelectedTeig(e.coordinate);
      if (selectedTeig) {
        useTeiger.getState().removeTeig(selectedTeig[0]);
        return;
      }

      await addTeigAtCoordinate(e.coordinate);
    }

    async function processDragCoordinates() {
      if (isProcessingDrag) return;
      isProcessingDrag = true;

      while (active && dragSelections.length > 0) {
        const { coordinate, remove } = dragSelections.shift()!;
        const selectedTeig = findSelectedTeig(coordinate);
        if (remove && selectedTeig) {
          useTeiger.getState().removeTeig(selectedTeig[0]);
        } else if (!remove && !selectedTeig) {
          await addTeigAtCoordinate(coordinate);
        }
      }

      isProcessingDrag = false;
    }

    function handleMapDrag(e: MapBrowserEvent) {
      const pointerEvent = e.originalEvent as PointerEvent;
      if (pointerEvent.metaKey || pointerEvent.ctrlKey) {
        dragSelections.push({
          coordinate: [...e.coordinate],
          remove: pointerEvent.shiftKey,
        });
        void processDragCoordinates();
      }
    }

    map.on("click", handleMapClick);
    map.on("pointerdrag", handleMapDrag);
    return () => {
      active = false;
      map.un("click", handleMapClick);
      map.un("pointerdrag", handleMapDrag);
    };
  }, [map]);

  return null;
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
