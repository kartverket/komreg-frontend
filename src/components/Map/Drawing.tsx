import { useEffect, useState } from "react";
import { useMap } from "./MapContext";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Draw from "ol/interaction/Draw";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";
import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "@/components/ToggleButton/ToggleButton";
import { PencilLineIcon } from "@navikt/aksel-icons";

export function MapDrawing() {
  const [isMeasuringActive, setIsMeasuringActive] = useState(false);

  return (
    <>
      <Tooltip content={`Skru ${isMeasuringActive ? "av" : "på"} tegneverktøyet`}>
        <ToggleButton isActive={isMeasuringActive} onToggle={setIsMeasuringActive}>
          <PencilLineIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      {isMeasuringActive && <DrawingInteraction />}
    </>
  );
}

function DrawingInteraction() {
  const map = useMap();
  useEffect(() => {
    const source = new VectorSource();
    const style = [
      new Style({ stroke: new Stroke({ color: "#ffffff", width: 8 }) }),
      new Style({ stroke: new Stroke({ color: "#1a833b", width: 4 }) }),
    ];
    const layer = new VectorLayer({ source, style });
    const pointStyle = new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: "#1a833b" }),
        stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
      }),
    });
    const draw = new Draw({
      source,
      type: "LineString",
      style: (feature) => (feature.getGeometry()?.getType() === "Point" ? pointStyle : style),
    });
    draw.setActive(true);
    map.addLayer(layer);
    map.addInteraction(draw);
    return () => {
      map.removeInteraction(draw);
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}
