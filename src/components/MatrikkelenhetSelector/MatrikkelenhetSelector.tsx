import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "../ToggleButton/ToggleButton";
import { NotePencilDashIcon } from "@navikt/aksel-icons";
import { useEffect, useRef } from "react";
import { useMap } from "../Map/MapContext";
import { Feature, type MapBrowserEvent } from "ol";
import type { Coordinate } from "ol/coordinate";
import Fill from "ol/style/Fill";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Polygon from "ol/geom/Polygon";
import { VectorLayer } from "../Map/VectorLayer";
import { useVectorSource } from "../Map/VectorLayerContext";
import { useTeiger } from "@/hooks/useTeiger";
import { getAllTeigerInGrunnkretsAtPoint, getMatrikkelenhetAtPoint } from "@/utils/TeigUtils";
import type { TeigResponse } from "@/types/TeigResponse";
import type { MatrikkelenhetResponse } from "@/types/Matrikkelenhet";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";

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
  const { matrikkelenheter } = useMatrikkelenheter();
  return (
    <>
      <Tooltip content={`Skru ${isActive ? "av" : "på"} henting av matrikkelenheter`}>
        <ToggleButton
          isActive={isActive}
          onToggle={onToggle}
          data-testid="matrikkelenhet-selector-toggle-button"
        >
          <NotePencilDashIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      <VectorLayer style={matrikkelenhetLayerStyle}>
        {Array.from(matrikkelenheter.values()).map((matrikkelenhet) => (
          <Matrikkelenhet key={matrikkelenhet.id} enhet={matrikkelenhet} />
        ))}
        {isActive && <MapClickInteraction />}
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

async function withWaitCursor<T>(map: ReturnType<typeof useMap>, fn: () => Promise<T>): Promise<T> {
  const viewport = map.getViewport();
  if (!viewport) return fn();
  viewport.style.cursor = "wait";
  try {
    return await fn();
  } finally {
    viewport.style.cursor = "";
  }
}

function MapClickInteraction() {
  const map = useMap();

  useEffect(() => {
    let active = true;

    async function handleMapClick(e: MapBrowserEvent) {
      let res: MatrikkelenhetResponse | undefined;
      try {
        res = await withWaitCursor(map, () => getMatrikkelenhetAtPoint(e.coordinate));
      } catch (error) {
        console.error("Failed to retrieve matrikkelenhet", error);
        return;
      }

      if (res && active) {
        useMatrikkelenheter.getState().addMatrikkelenhet(res.id, res);
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

function Matrikkelenhet({ enhet }: { enhet: MatrikkelenhetResponse }) {
  return (
    <>
      {enhet.features.map((teig) => (
        <Teig key={teig.properties.lokalid} geometry={teig.geometry} />
      ))}
    </>
  );
}

function Teig({ geometry }: { geometry: TeigResponse["geometry"] }) {
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
