import type { TeigResponse } from "@/types/TeigResponse";
import type { Address } from "./Address";

export type MatrikkelenhetResponse = {
  id: string;
  features: TeigResponse[];
  addresses?: Address[];
};
