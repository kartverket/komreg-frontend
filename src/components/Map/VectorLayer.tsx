import { useEffect, useMemo, type ReactNode } from "react";
import OlVectorLayer from "ol/layer/Vector";
import type { StyleLike } from "ol/style/Style";
import { useMap } from "./MapContext";
import { VectorSourceContext } from "./VectorLayerContext";
import VectorSource from "ol/source/Vector";

export function VectorLayer({ children, style }: { children?: ReactNode; style?: StyleLike }) {
  const map = useMap();
  const source = useMemo(() => new VectorSource(), []);

  useEffect(() => {
    const layer = new OlVectorLayer({ source, style });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, source, style]);

  return <VectorSourceContext.Provider value={source}>{children}</VectorSourceContext.Provider>;
}
