import { useEffect, useRef, useState } from "react";
import { defaults as defaultInteractions, MouseWheelZoom } from "ol/interaction";
import OlMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control/defaults";
import { fromLonLat, toLonLat } from "ol/proj";
import "ol/ol.css";
import { MapContext } from "./MapContext";
import styles from "./Map.module.css";

export type MapPosition = { lat: number; lon: number; zoom: number };

export function Map({
  children,
  initialPosition,
  onPositionChange,
}: {
  children?: React.ReactNode;
  initialPosition?: MapPosition;
  onPositionChange?: (position: MapPosition) => void;
}) {
  const [map, setMap] = useState<OlMap | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  // Only the first position is used; later changes come from the map itself.
  const initialRef = useRef(initialPosition);
  const onChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onChangeRef.current = onPositionChange;
  });
  useEffect(() => {
    const initial = initialRef.current;
    const map = new OlMap({
      target: targetRef.current!,
      layers: [],
      view: new View({
        center: fromLonLat(initial ? [initial.lon, initial.lat] : [15, 65]),
        zoom: initial?.zoom ?? 5,
        maxZoom: 18,
      }),
      controls: defaultControls({ attributionOptions: { collapsible: false } }),
      // Snappier wheel zoom: shorter animation (default 250ms) + bigger step per tick.
      interactions: defaultInteractions({ mouseWheelZoom: false }).extend([
        new MouseWheelZoom({ duration: 100, maxDelta: 1.4 }),
      ]),
    });
    map.on("moveend", () => {
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (!center || zoom === undefined) return;
      const lonLat = toLonLat(center);
      const lon = lonLat[0] ?? 0;
      const lat = lonLat[1] ?? 0;
      onChangeRef.current?.({
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        zoom: Number(zoom.toFixed(2)),
      });
    });
    setMap(map);
    return () => map.dispose();
  }, []);
  return (
    <MapContext.Provider value={map}>
      <div ref={targetRef} className={styles.mapsurface} role="region" aria-label="Kart over Norge">
        {map && children /* Only render children when the map is initialized */}
      </div>
    </MapContext.Provider>
  );
}
