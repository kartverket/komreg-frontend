import { create } from "zustand";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";

export const useMatrikkelenheter = create<{
  matrikkelenheter: Map<string, Matrikkelenhet>;
  setMatrikkelenheter: (matrikkelenheter: Map<string, Matrikkelenhet>) => void;
  clearMatrikkelenheter: () => void;
  addMatrikkelenhet: (id: string, matrikkelenhet: Matrikkelenhet) => void;
  removeMatrikkelenhet: (id: string) => void;
}>((set) => ({
  matrikkelenheter: new Map(),
  setMatrikkelenheter: (matrikkelenheter: Map<string, Matrikkelenhet>) => set({ matrikkelenheter }),
  clearMatrikkelenheter: () => set({ matrikkelenheter: new Map() }),
  addMatrikkelenhet: (id: string, matrikkelenhet: Matrikkelenhet) =>
    set((state) => {
      const matrikkelenheter = new Map(state.matrikkelenheter);
      matrikkelenheter.set(id, matrikkelenhet);
      return { matrikkelenheter };
    }),
  removeMatrikkelenhet: (id: string) =>
    set((state) => {
      const matrikkelenheter = new Map(state.matrikkelenheter);
      const enhetToDelete = matrikkelenheter.get(id);
      if (enhetToDelete) {
        enhetToDelete.connectedToOtherUnits?.forEach((connectedId) => {
          matrikkelenheter.delete(connectedId);
        });
        matrikkelenheter.delete(id);
      }
      return { matrikkelenheter };
    }),
}));
