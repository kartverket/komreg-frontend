import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TeigResponse } from "@/types/TeigResponse";
import { Map as OlMap } from "@/components/Map/_Map";
import { MatrikkelenhetSelector } from "./MatrikkelenhetSelector";
import { useTeiger } from "@/hooks/useTeiger";
import { useEffect } from "react";
import { useMap } from "@/components/Map/MapContext";
import { MapBrowserEvent, type Map as OlMapType } from "ol";
import * as TeigUtils from "@/utils/TeigUtils";

function MapCapture({ onMap }: { onMap: (map: OlMapType) => void }) {
  let map = useMap();
  useEffect(() => {
    onMap(map);
  }, [onMap, map]);
  return null;
}
// MatrikkelenhetSelector needs a real `ol/Map` instance in context (via useMap) and a
// VectorLayer source (via useVectorSource). The component renders those itself, but it
// still needs the outer <Map> to provide the OpenLayers map. The <Map> only renders its
// children once the map is initialized (see `_Map.tsx`), so every query below must use
// `findBy...` (async) rather than `getBy...` for the first lookup.
function renderSelector(isActive: boolean, onToggle = vi.fn<(isActive: boolean) => void>()) {
  let map: OlMapType | undefined;
  render(
    <OlMap>
      <MapCapture
        onMap={(m) => {
          map = m;
        }}
      />
      <MatrikkelenhetSelector isActive={isActive} onToggle={onToggle} />
    </OlMap>,
  );
  return { onToggle, map: map as OlMapType };
}

// Builds a fake API response for one spot of land ("teig"). Only fields the component
// actually reads are filled in with real values; everything else is irrelevant filler.
function buildTeigResponse(lokalid: number): TeigResponse {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    properties: {
      bruksnummer: 1,
      festenummer: 0,
      gardsnummer: 1,
      hovedområde: true,
      kommunenummer: "0301",
      lokalid,
      matrikkelnummertekst: "1/1",
      meterFraPunkt: 0,
      nøyaktighetsklasseteig: "god",
      objekttype: "Teig",
      oppdateringsdato: "2024-01-01",
      seksjonsnummer: 0,
      teigmedflerematrikkelenheter: false,
      uregistrertjordsameie: false,
    },
  };
}

describe("MatrikkelenhetSelector", () => {
  // The teiger ("plots of land") live in a module-level zustand store, so without this
  // reset, state added by one test would leak into the next one.
  beforeEach(() => {
    useTeiger.getState().clearTeiger();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not add a teig if it is deactivated", async () => {
    const response = buildTeigResponse(123);
    const mockedFetch = vi
      .fn<() => Promise<{ ok: boolean; json: () => Promise<{ features: TeigResponse[] }> }>>()
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      });
    vi.stubGlobal("fetch", mockedFetch);

    const { map } = renderSelector(false);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(mockedFetch).toHaveBeenCalledTimes(0);
    });
  });

  it("does not add a teig when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Fetch failed")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { map } = renderSelector(true);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(consoleError).toHaveBeenCalledTimes(1);
    });
  });

  it("does not add a teig when the map is clicked while inactive", async () => {
    const response = buildTeigResponse(123);
    const mockedFetch = vi
      .fn<() => Promise<{ ok: boolean; json: () => Promise<{ features: TeigResponse[] }> }>>()
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      });
    vi.stubGlobal("fetch", mockedFetch);

    const { map } = renderSelector(false);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(mockedFetch).toHaveBeenCalledTimes(0);
    });
  });

  it("adds a teig when the map is clicked while active", async () => {
    const response = buildTeigResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(true);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.has(123)).toBe(true);
    });
  });

  it("removes a teig when the map is clicked on an existing teig while active", async () => {
    // Pre-populate the store with a teig so it can be removed.
    useTeiger.getState().addTeig(123, buildTeigResponse(123));

    const response = buildTeigResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(true);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));

    event.coordinate = [0, 0]; // must be within the polygon of the buildEiendomResponse(123)

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.has(123)).toBe(false);
    });
  });
  it("fetches all teiger in a grunnkrets when shift is held while clicking", async () => {
    const { map } = renderSelector(true);

    const event = new MapBrowserEvent<PointerEvent>(
      "click",
      map,
      new PointerEvent("click", { shiftKey: true }),
    );

    event.coordinate = [0, 0];

    vi.spyOn(TeigUtils, "getAllTeigerInGrunnkretsAtPoint").mockResolvedValue([
      buildTeigResponse(123),
      buildTeigResponse(321),
      buildTeigResponse(567),
    ]);

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.has(123)).toBe(true);
      expect(useTeiger.getState().teiger.has(321)).toBe(true);
      expect(useTeiger.getState().teiger.has(567)).toBe(true);
    });
  });
  it("Tooltip has correct text when deactivated", async () => {
    renderSelector(false);
    const toggleButton = await screen.findByTestId("matrikkelenhet-selector-toggle-button");
    expect(toggleButton).toHaveAttribute("data-tooltip", "Skru på henting av matrikkelenheter");
  });
  it("Tooltip has correct text when activated", async () => {
    renderSelector(true);
    const toggleButton = await screen.findByTestId("matrikkelenhet-selector-toggle-button");
    expect(toggleButton).toHaveAttribute("data-tooltip", "Skru av henting av matrikkelenheter");
  });
});
