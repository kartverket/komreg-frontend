import { useEffect } from "react";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { useMap } from "./MapContext";

type WMSLayerProps = {
  className?: string;
  layers: string;
  minZoom: number;
  url: string;
};

export function WMSLayer({ className, layers, minZoom, url }: WMSLayerProps) {
  const map = useMap();

  useEffect(() => {
    const layer = new TileLayer({
      className,
      minZoom,
      source: new TileWMS({
        attributions: "© Kartverket",
        params: { LAYERS: layers, TRANSPARENT: true },
        url,
      }),
    });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [className, layers, map, minZoom, url]);

  return null;
}
