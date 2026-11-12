import type { Coordinate } from "ol/coordinate";

export type Teig = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  //blir brukt i matrikkelenhetSelector for å koble teigen til en matrikkelenhet
  matrikkelenhetId?: string;
  properties: {
    lokalid: number;
    // false når teigen ligger utenfor grunnkretsen den ble hentet med
    inKrets?: boolean;
  };
};
