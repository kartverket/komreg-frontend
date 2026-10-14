import { useEffect, useRef, useState } from "react";
import { defaults as defaultInteractions, MouseWheelZoom } from "ol/interaction";
import OlMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control/defaults";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";
import { MapContext } from "./MapContext";
import styles from "./Map.module.css";

export function Map({ children }: { children?: React.ReactNode }) {
    const [map, setMap] = useState<OlMap | null>(null);
    const targetRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const map = new OlMap({
            target: targetRef.current!,
            layers: [],
            view: new View({ center: fromLonLat([15, 65]), zoom: 5, maxZoom: 18 }),
            controls: defaultControls({ attributionOptions: { collapsible: false } }),
            // Snappier wheel zoom: shorter animation (default 250ms) + bigger step per tick.
            interactions: defaultInteractions({ mouseWheelZoom: false }).extend([
                new MouseWheelZoom({ duration: 100, maxDelta: 1.4 }),
            ]),
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