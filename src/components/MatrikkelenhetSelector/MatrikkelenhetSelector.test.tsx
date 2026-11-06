import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Teig } from "@/types/TeigResponse";
import { Map as OlMap } from "@/components/Map/_Map";
import { MatrikkelenhetSelector } from "./MatrikkelenhetSelector";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import { useEffect } from "react";
import { useMap } from "@/components/Map/MapContext";
import { MapBrowserEvent, type Map as OlMapType } from "ol";
import type { Coordinate } from "ol/coordinate";
import OlVectorLayer from "ol/layer/Vector";
import { transform } from "ol/proj";
import { getMatrikkelenheterConnectedToTeigAtPoint } from "@/utils/TeigUtils";

vi.mock("@/utils/TeigUtils", () => ({
  getMatrikkelenheterConnectedToTeigAtPoint:
    vi.fn<typeof getMatrikkelenheterConnectedToTeigAtPoint>(),
}));

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
function buildTeigResponse(id: number): Teig {
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
      lokalid: id,
    },
  };
}

function buildMatrikkelenhet(id: string, lokalids: number[]): Matrikkelenhet {
  return {
    id,
    features: lokalids.map(buildTeigResponse),
    connectedToOtherUnits: [],
    matrikkelnummer: { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 1 },
  };
}

function mockMatrikkelenheterAtPoint(matrikkelenheter: Matrikkelenhet[]) {
  return vi.mocked(getMatrikkelenheterConnectedToTeigAtPoint).mockResolvedValue(matrikkelenheter);
}

function click(map: OlMapType, coordinate: Coordinate) {
  const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
  event.coordinate = coordinate;
  map.dispatchEvent(event);
}

// What is actually drawn: every feature in every vector layer on the map.
function getMapFeatures(map: OlMapType) {
  return map
    .getAllLayers()
    .flatMap((layer) =>
      layer instanceof OlVectorLayer ? (layer.getSource()?.getFeatures() ?? []) : [],
    );
}

function getMatrikkelenhetIdsInMap(map: OlMapType) {
  return getMapFeatures(map).map((feature) => feature.get("matrikkelenhetId") as string);
}

// A point inside the polygon from buildTeigResponse. Teig geometries are in EPSG:32633 and
// transformed to the map projection (EPSG:3857) when drawn, so the click must be too.
const INSIDE_TEIG: Coordinate = transform([0.75, 0.25], "EPSG:32633", "EPSG:3857");

describe("MatrikkelenhetSelector", () => {
  // reset, state added by one test would leak into the next one.
  beforeEach(() => {
    useMatrikkelenheter.getState().clearMatrikkelenheter();
    vi.mocked(getMatrikkelenheterConnectedToTeigAtPoint).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch or draw anything when the map is clicked while inactive", async () => {
    const mockedGet = mockMatrikkelenheterAtPoint([buildMatrikkelenhet("0301/1/1", [123])]);
    const { map } = renderSelector(false);

    click(map, INSIDE_TEIG);

    // Let any (unexpected) async handler settle before asserting the negative.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedGet).not.toHaveBeenCalled();
    expect(getMapFeatures(map)).toHaveLength(0);
  });

  it("draws nothing when the fetch rejects", async () => {
    vi.mocked(getMatrikkelenheterConnectedToTeigAtPoint).mockRejectedValue(
      new Error("Fetch failed"),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { map } = renderSelector(true);

    click(map, INSIDE_TEIG);

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(getMapFeatures(map)).toHaveLength(0);
  });

  it("draws every teig of the matrikkelenhet when the map is clicked while active", async () => {
    mockMatrikkelenheterAtPoint([buildMatrikkelenhet("0301/1/1", [123, 321])]);
    const { map } = renderSelector(true);

    click(map, INSIDE_TEIG);

    await vi.waitFor(() => {
      expect(getMatrikkelenhetIdsInMap(map)).toEqual(["0301/1/1", "0301/1/1"]);
    });
  });

  it("removes the whole matrikkelenhet from the map when one of its teiger is clicked", async () => {
    const mockedGet = mockMatrikkelenheterAtPoint([]);
    const teigElsewhere = buildTeigResponse(3);
    teigElsewhere.geometry.coordinates = [
      [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 10],
      ],
    ];
    useMatrikkelenheter.getState().addMatrikkelenhet("a", buildMatrikkelenhet("a", [1, 2]));
    useMatrikkelenheter.getState().addMatrikkelenhet("b", {
      id: "b",
      features: [teigElsewhere],
      matrikkelnummer: { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 1 },
    });
    const { map } = renderSelector(true);
    await vi.waitFor(() => expect(getMatrikkelenhetIdsInMap(map).sort()).toEqual(["a", "a", "b"]));

    click(map, INSIDE_TEIG);

    await vi.waitFor(() => expect(getMatrikkelenhetIdsInMap(map)).toEqual(["b"]));
    expect(mockedGet).not.toHaveBeenCalled();
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
