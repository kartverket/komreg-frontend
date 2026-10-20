import { createContext, useContext } from "react";
import VectorSource from "ol/source/Vector";

export const VectorSourceContext = createContext<VectorSource | null>(null);

export function useVectorSource() {
  const source = useContext(VectorSourceContext);
  if (!source) {
    throw new Error("useVectorSource must be used within a VectorLayer");
  }
  return source;
}
