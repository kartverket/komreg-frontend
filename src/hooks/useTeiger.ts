import { create } from "zustand";
import type { EiendomResponse } from "@/components/MatrikkelenhetSelector";

export const useTeiger = create<{
  teiger: Map<number, EiendomResponse>;
  setTeiger: (teiger: Map<number, EiendomResponse>) => void;
  clearTeiger: () => void;
  addTeig: (lokalid: number, teig: EiendomResponse) => void;
  removeTeig: (lokalid: number) => void;
}>((set) => ({
  teiger: new Map(),
  setTeiger: (teiger: Map<number, EiendomResponse>) => set({ teiger }),
  clearTeiger: () => set({ teiger: new Map() }),
  addTeig: (lokalid: number, teig: EiendomResponse) =>
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
