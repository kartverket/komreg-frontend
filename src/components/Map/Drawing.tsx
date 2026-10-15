import { useEffect, useState } from "react";
import { useMap } from "./MapContext";
import { useVectorSource } from "./VectorLayerContext";
import Draw from "ol/interaction/Draw";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";
import { Button, Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "@/components/ToggleButton/ToggleButton";
import { PencilLineIcon, XMarkIcon } from "@navikt/aksel-icons";
import { VectorLayer } from "./VectorLayer";
import styles from "./Drawing.module.css";

const style = [
  new Style({ stroke: new Stroke({ color: "#ffffff", width: 8 }) }),
  new Style({ stroke: new Stroke({ color: "#1a833b", width: 4 }) }),
];
export function MapDrawing() {
  return (
    <VectorLayer style={style}>
      <DrawingControls />
    </VectorLayer>
  );
}

function DrawingControls() {
  const [isMeasuringActive, setIsMeasuringActive] = useState(false);
  const source = useVectorSource();

  return (
    <div className={styles.buttoncontainer}>
      {isMeasuringActive && (
        <Button
          className={styles.clearbutton}
          icon
          data-size="sm"
          data-color="danger"
          variant="primary"
          aria-label="Clear drawing"
          onClick={() => source.clear()}
        >
          <XMarkIcon></XMarkIcon>
        </Button>
      )}
      <Tooltip content={`Skru ${isMeasuringActive ? "av" : "på"} tegneverktøyet`}>
        <ToggleButton isActive={isMeasuringActive} onToggle={setIsMeasuringActive}>
          <PencilLineIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      {isMeasuringActive && <DrawingInteraction />}
    </div>
  );
}

function DrawingInteraction() {
  const map = useMap();
  const source = useVectorSource();
  useEffect(() => {
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
    map.addInteraction(draw);
    return () => {
      map.removeInteraction(draw);
    };
  }, [map, source]);
  return null;
}
