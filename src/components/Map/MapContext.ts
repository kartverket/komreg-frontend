import { createContext, useContext } from "react";
import OlMap from "ol/Map";

export const MapContext = createContext<OlMap | null>(null);

export function useMap() {
  const map = useContext(MapContext);
  if (!map) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return map;
}
