import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Map as OlMap } from "./Map/_Map";
import { MatrikkelenhetSelector, type EiendomResponse } from "./MatrikkelenhetSelector";
import { useTeiger } from "@/hooks/useTeiger";
import { useEffect } from "react";
import { useMap } from "./Map/MapContext";
import { MapBrowserEvent, type Map as OlMapType } from "ol";

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
function buildEiendomResponse(lokalid: number, east = 0): EiendomResponse {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [east, 0],
          [east + 1, 0],
          [east + 1, 1],
          [east, 0],
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

  it("does not add a teig if it is deactivated before the fetch completes", async () => {
    const response = buildEiendomResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(false);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(vi.fn()).toHaveBeenCalledTimes(0);
    });
  });

  it("does not add a teig when the map is clicked while inactive", async () => {
    const response = buildEiendomResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(false);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(vi.fn()).toHaveBeenCalledTimes(0);
    });
  });

  it("does not add a teig when the map is clicked while inactive", async () => {
    const response = buildEiendomResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(false);

    const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
    event.coordinate = [0, 0];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(vi.fn()).toHaveBeenCalledTimes(0);
    });
  });

  it("adds a teig when the map is clicked while active", async () => {
    const response = buildEiendomResponse(123);
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

  it.each([
    ["Command", { metaKey: true }],
    ["Control", { ctrlKey: true }],
  ])("adds a teig while dragging with %s held", async (_key, pointerEventInit) => {
    const response = buildEiendomResponse(123);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [response] }),
      }),
    );

    const { map } = renderSelector(true);
    const event = new MapBrowserEvent<PointerEvent>(
      "pointerdrag",
      map,
      new PointerEvent("pointermove", pointerEventInit),
    );
    event.coordinate = [0.5, 0.25];

    map.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.has(123)).toBe(true);
    });
  });

  it("adds every teig encountered during a modifier-key drag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string) => {
        const east = Number(new URL(input).searchParams.get("ost"));
        const response = east < 2 ? buildEiendomResponse(123) : buildEiendomResponse(456, 2);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ features: [response] }),
        });
      }),
    );

    const { map } = renderSelector(true);
    for (const coordinate of [
      [0.5, 0.25],
      [2.5, 0.25],
    ]) {
      const event = new MapBrowserEvent<PointerEvent>(
        "pointerdrag",
        map,
        new PointerEvent("pointermove", { metaKey: true }),
      );
      event.coordinate = coordinate;
      map.dispatchEvent(event);
    }

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.has(123)).toBe(true);
      expect(useTeiger.getState().teiger.has(456)).toBe(true);
    });
  });

  it.each([
    ["Command", { metaKey: true, shiftKey: true }],
    ["Control", { ctrlKey: true, shiftKey: true }],
  ])("removes every selected teig encountered while dragging with %s+Shift", async (_, keys) => {
    useTeiger.getState().addTeig(123, buildEiendomResponse(123));
    useTeiger.getState().addTeig(456, buildEiendomResponse(456, 2));
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const { map } = renderSelector(true);
    for (const coordinate of [
      [0.5, 0.25],
      [2.5, 0.25],
    ]) {
      const event = new MapBrowserEvent<PointerEvent>(
        "pointerdrag",
        map,
        new PointerEvent("pointermove", keys),
      );
      event.coordinate = coordinate;
      map.dispatchEvent(event);
    }

    await vi.waitFor(() => {
      expect(useTeiger.getState().teiger.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("removes a teig when the map is clicked on an existing teig while active", async () => {
    // Pre-populate the store with a teig so it can be removed.
    useTeiger.getState().addTeig(123, buildEiendomResponse(123));

    const response = buildEiendomResponse(123);
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
});
