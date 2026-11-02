import type { Coordinate } from "ol/coordinate";

export type TeigResponse = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  properties: {
    parcelId: number;
  };
};
