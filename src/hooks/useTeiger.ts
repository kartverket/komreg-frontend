import { create } from "zustand";
import type { TeigResponse } from "@/components/MatrikkelenhetSelector/MatrikkelenhetSelector";

export const useTeiger = create<{
  teiger: Map<number, TeigResponse>;
  setTeiger: (teiger: Map<number, TeigResponse>) => void;
  clearTeiger: () => void;
  addTeig: (lokalid: number, teig: TeigResponse) => void;
  removeTeig: (lokalid: number) => void;
}>((set) => ({
  teiger: new Map(),
  setTeiger: (teiger: Map<number, TeigResponse>) => set({ teiger }),
  clearTeiger: () => set({ teiger: new Map() }),
  addTeig: (lokalid: number, teig: TeigResponse) =>
    set((state) => {
      const teiger = new Map(state.teiger);
      teiger.set(lokalid, teig);
      return { teiger };
    }),
  removeTeig: (lokalid: number) =>
    set((state) => {
      const teiger = new Map(state.teiger);
      teiger.delete(lokalid);
      return { teiger };
    }),
}));
