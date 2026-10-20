import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "../ToggleButton/ToggleButton";
import { NotePencilDashIcon } from "@navikt/aksel-icons";
import { useEffect } from "react";
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
import { fetchTeigAtPoint, getAllTeigerInGrunnkretsAtPoint } from "@/utils/TeigUtils";
import type { TeigResponse } from "@/types/TeigResponse";

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
      if (e.originalEvent?.shiftKey) {
        const teigerFraGrunnkrets = await getAllTeigerInGrunnkretsAtPoint(e.coordinate);

        for (const teig of teigerFraGrunnkrets) {
          useTeiger.getState().addTeig(teig.properties.lokalid, teig);
        }
        return;
      }

      for (const [lokalid, teig] of useTeiger.getState().teiger) {
        if (checkIfCoordinateIntersectsPolygon(e.coordinate, teig.geometry.coordinates)) {
          useTeiger.getState().removeTeig(lokalid);
          return;
        }
      }

      let data: TeigResponse | undefined;
      try {
        data = await fetchTeigAtPoint(e.coordinate);
      } catch (error) {
        console.error("Failed to retrieve matrikkelenhet", error);
        return;
      }

      if (data && active) {
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
