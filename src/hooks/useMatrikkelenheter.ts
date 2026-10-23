import { create } from "zustand";
import type { MatrikkelenhetResponse } from "@/types/Matrikkelenhet";

export const useMatrikkelenheter = create<{
  matrikkelenheter: Map<string, MatrikkelenhetResponse>;
  setMatrikkelenheter: (matrikkelenheter: Map<string, MatrikkelenhetResponse>) => void;
  clearMatrikkelenheter: () => void;
  addMatrikkelenhet: (id: string, matrikkelenhet: MatrikkelenhetResponse) => void;
  removeMatrikkelenhet: (id: string) => void;
}>((set) => ({
  matrikkelenheter: new Map(),
  setMatrikkelenheter: (matrikkelenheter: Map<string, MatrikkelenhetResponse>) =>
    set({ matrikkelenheter }),
  clearMatrikkelenheter: () => set({ matrikkelenheter: new Map() }),
  addMatrikkelenhet: (id: string, matrikkelenhet: MatrikkelenhetResponse) =>
    set((state) => {
      const matrikkelenheter = new Map(state.matrikkelenheter);
      matrikkelenheter.set(id, matrikkelenhet);
      return { matrikkelenheter };
    }),
  removeMatrikkelenhet: (id: string) =>
    set((state) => {
      const matrikkelenheter = new Map(state.matrikkelenheter);
      matrikkelenheter.delete(id);
      return { matrikkelenheter };
    }),
}));
