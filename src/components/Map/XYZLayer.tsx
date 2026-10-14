import { useEffect } from "react";
import { useMap } from "./MapContext";
import XYZ from "ol/source/XYZ";
import TileLayer from "ol/layer/Tile";

export function XYZLayer({ tileUrl }: { tileUrl: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = new TileLayer({
      source: new XYZ({ url: tileUrl, attributions: "© Kartverket" }),
    });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, tileUrl]);
  return null;
}
