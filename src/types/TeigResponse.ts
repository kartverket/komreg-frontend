import type { Coordinate } from "ol/coordinate";

export type Teig = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  properties: {
    lokalid: number;
  };
};
