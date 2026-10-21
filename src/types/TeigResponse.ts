import type { Coordinate } from "ol/coordinate";

export type TeigResponse = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  properties: {
    bruksnummer: number;
    festenummer: number;
    gardsnummer: number;
    hovedområde: boolean;
    kommunenummer: string;
    lokalid: number;
    matrikkelnummertekst: string;
    meterFraPunkt: number;
    nøyaktighetsklasseteig: string;
    objekttype: string;
    oppdateringsdato: string;
    seksjonsnummer: number | null;
    teigmedflerematrikkelenheter: boolean;
    uregistrertjordsameie: boolean;
  };
};
