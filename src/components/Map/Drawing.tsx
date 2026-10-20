import { useEffect } from "react";
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
export function MapDrawing({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  return (
    <VectorLayer style={style}>
      <DrawingControls isActive={isActive} onToggle={onToggle} />
    </VectorLayer>
  );
}

function DrawingControls({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  const source = useVectorSource();

  return (
    <div className={styles.buttoncontainer}>
      {isActive && (
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
      <Tooltip content={`Skru ${isActive ? "av" : "på"} tegneverktøyet`}>
        <ToggleButton isActive={isActive} onToggle={onToggle}>
          <PencilLineIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      {isActive && <DrawingInteraction />}
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
    const abortDrawing = () => draw.abortDrawing();
    source.on("clear", abortDrawing);
    return () => {
      source.un("clear", abortDrawing);
      map.removeInteraction(draw);
    };
  }, [map, source]);
  return null;
}
