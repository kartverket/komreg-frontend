import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type OlMap from "ol/Map";
import { describe, expect, it, vi } from "vite-plus/test";
import { MapContext } from "@/components/Map/MapContext";
import { MapSearch } from "./MapSearch";
import { parseSearchTarget } from "./MapSearch.utils";

describe("parseSearchTarget", () => {
  it("recognizes a municipality number", () => {
    expect(parseSearchTarget(" 3322 ")).toEqual({ type: "kommune", kommunenummer: "3322" });
  });

  it("recognizes cadastral numbers with an optional lease number", () => {
    expect(parseSearchTarget("3322-123/1")).toEqual({
      type: "matrikkelnummer",
      kommunenummer: "3322",
      gardsnummer: "123",
      bruksnummer: "1",
      festenummer: undefined,
    });
    const target = parseSearchTarget("3322-123/1/4");
    expect(target?.type).toBe("matrikkelnummer");
    if (target?.type !== "matrikkelnummer") throw new Error("Expected a cadastral number");
    expect(target.festenummer).toBe("4");
  });

  it("rejects unsupported formats", () => {
    expect(parseSearchTarget("Oslo")).toBeNull();
    expect(parseSearchTarget("3322-123")).toBeNull();
    expect(parseSearchTarget("33221")).toBeNull();
  });
});

describe("MapSearch", () => {
  it("opens and focuses the search field with Ctrl+Enter", async () => {
    render(
      <MapContext.Provider value={{} as OlMap}>
        <MapSearch />
      </MapContext.Provider>,
    );

    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    expect(screen.getByRole("textbox", { name: "Finn i kartet" })).toHaveFocus();
  });

  it("gives feedback for an unsupported format without making a request", async () => {
    render(
      <MapContext.Provider value={{} as OlMap}>
        <MapSearch />
      </MapContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Finn i kartet" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Finn i kartet" }), "Oslo");
    await userEvent.click(screen.getByRole("button", { name: "Søk" }));

    expect(screen.getByText(/Skriv kommunenummer/)).toBeVisible();
  });

  it("fits municipality bounds in the map projection", async () => {
    const fit = vi.fn<(extent: number[], options: object) => void>();
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Pick<Response, "json" | "ok" | "status">>>()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            avgrensningsboks: {
              coordinates: [
                [
                  [966414, 8487813],
                  [1050320, 8557527],
                ],
              ],
            },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MapContext.Provider value={{ getView: () => ({ fit }) } as unknown as OlMap}>
        <MapSearch />
      </MapContext.Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Finn i kartet" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Finn i kartet" }), "3322");
    await userEvent.click(screen.getByRole("button", { name: "Søk" }));

    expect(await screen.findByText("Viser kommune 3322.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("utkoordsys=3857"));
    expect(fit).toHaveBeenCalledWith(
      [966414, 8487813, 1050320, 8557527],
      expect.objectContaining({ duration: 400 }),
    );
  });
});
