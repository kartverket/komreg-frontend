import type { Teig } from "@/types/TeigResponse";
import type { Address } from "./Address";

export type Matrikkelenhet = {
  id: string;
  features: Teig[];
  addresses?: Address[];
  connectedToOtherUnits?: string[];
  matrikkelnummer?: {
    kommunenummer: string;
    gardsnummer: number;
    bruksnummer: number;
  };
};
