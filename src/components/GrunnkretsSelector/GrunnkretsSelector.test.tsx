import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useEffect } from "react";
import { MapBrowserEvent, type Map as OlMapType } from "ol";
import OlVectorLayer from "ol/layer/Vector";
import { Map as OlMap } from "@/components/Map/_Map";
import { useMap } from "@/components/Map/MapContext";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";
import {
  getGrunnkretsAtPoint,
  getMatrikkelenheterInGrunnkrets,
  type ReguleringApiGrunnkrets,
} from "@/utils/TeigUtils";
import { GrunnkretsSelector } from "./GrunnkretsSelector";

vi.mock("@/utils/TeigUtils", () => ({
  getGrunnkretsAtPoint: vi.fn<typeof getGrunnkretsAtPoint>(),
  getMatrikkelenheterInGrunnkrets: vi.fn<typeof getMatrikkelenheterInGrunnkrets>(),
}));

function MapCapture({ onMap }: { onMap: (map: OlMapType) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [onMap, map]);
  return null;
}

// <Map> only renders its children once the map is initialized, so the first lookup in every
// test must be async (`findBy...`).
function renderSelector(isActive: boolean) {
  let map: OlMapType | undefined;
  render(
    <OlMap>
      <MapCapture
        onMap={(m) => {
          map = m;
        }}
      />
      <GrunnkretsSelector isActive={isActive} onToggle={vi.fn<(isActive: boolean) => void>()} />
    </OlMap>,
  );
  return { getMap: () => map as OlMapType };
}

function click(map: OlMapType) {
  const event = new MapBrowserEvent<PointerEvent>("click", map, new PointerEvent("click"));
  event.coordinate = [910000, 8670000];
  map.dispatchEvent(event);
}

function getMapFeatures(map: OlMapType) {
  return map
    .getAllLayers()
    .flatMap((layer) =>
      layer instanceof OlVectorLayer ? (layer.getSource()?.getFeatures() ?? []) : [],
    );
}

const liabygda: ReguleringApiGrunnkrets = {
  type: "Feature",
  id: 7,
  featureType: "Krets",
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    ],
  },
  properties: { municipalityNumber: "1525", kretsnummer: 101, kretsnavn: "Liabygda" },
};

function buildMatrikkelenhet(id: string, teiger: { lokalid: number; inKrets: boolean }[]) {
  return {
    id,
    features: teiger.map((properties) => ({
      type: "Feature",
      geometry: { type: "Polygon" as const, coordinates: [[[0, 0]]] },
      properties,
    })),
    connectedToOtherUnits: [],
    matrikkelnummer: { kommunenummer: "1525", gardsnummer: 10, bruksnummer: 1 },
  } satisfies Matrikkelenhet;
}

describe("GrunnkretsSelector", () => {
  beforeEach(() => {
    useMatrikkelenheter.getState().clearMatrikkelenheter();
    vi.mocked(getGrunnkretsAtPoint).mockReset();
    vi.mocked(getMatrikkelenheterInGrunnkrets).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not look up a krets when the map is clicked while inactive", async () => {
    const { getMap } = renderSelector(false);
    await screen.findByTestId("grunnkrets-selector-toggle-button");

    click(getMap());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getGrunnkretsAtPoint).not.toHaveBeenCalled();
  });

  it("draws the krets and waits for confirmation before fetching its teiger", async () => {
    vi.mocked(getGrunnkretsAtPoint).mockResolvedValue(liabygda);
    const { getMap } = renderSelector(true);
    await screen.findByTestId("grunnkrets-selector-toggle-button");

    click(getMap());

    expect(await screen.findByText(/Liabygda \(krets 101 i kommune 1525\)/)).toBeInTheDocument();
    expect(getMapFeatures(getMap())).toHaveLength(1);
    expect(getMatrikkelenheterInGrunnkrets).not.toHaveBeenCalled();
  });

  it("adds the matrikkelenheter in the krets and reports teiger outside it", async () => {
    vi.mocked(getGrunnkretsAtPoint).mockResolvedValue(liabygda);
    vi.mocked(getMatrikkelenheterInGrunnkrets).mockResolvedValue([
      buildMatrikkelenhet("1525/10/1", [
        { lokalid: 1, inKrets: true },
        { lokalid: 2, inKrets: false },
      ]),
      buildMatrikkelenhet("1525/10/2", [{ lokalid: 3, inKrets: true }]),
    ]);
    const { getMap } = renderSelector(true);
    await screen.findByTestId("grunnkrets-selector-toggle-button");
    click(getMap());

    await userEvent.click(await screen.findByRole("button", { name: "Hent teiger" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Hentet 2 matrikkelenheter i Liabygda. 1 teiger ligger utenfor kretsen.",
    );
    expect(getMatrikkelenheterInGrunnkrets).toHaveBeenCalledWith(7);
    expect([...useMatrikkelenheter.getState().matrikkelenheter.keys()]).toEqual([
      "1525/10/1",
      "1525/10/2",
    ]);
    // Omrisset fjernes når teigene er hentet
    expect(getMapFeatures(getMap())).toHaveLength(0);
  });

  it("drops the krets when the user cancels", async () => {
    vi.mocked(getGrunnkretsAtPoint).mockResolvedValue(liabygda);
    const { getMap } = renderSelector(true);
    await screen.findByTestId("grunnkrets-selector-toggle-button");
    click(getMap());

    await userEvent.click(await screen.findByRole("button", { name: "Avbryt" }));

    expect(screen.queryByText(/Liabygda/)).not.toBeInTheDocument();
    expect(getMapFeatures(getMap())).toHaveLength(0);
    expect(getMatrikkelenheterInGrunnkrets).not.toHaveBeenCalled();
  });

  it("says so when no grunnkrets covers the point", async () => {
    vi.mocked(getGrunnkretsAtPoint).mockResolvedValue(undefined);
    const { getMap } = renderSelector(true);
    await screen.findByTestId("grunnkrets-selector-toggle-button");

    click(getMap());

    expect(await screen.findByRole("status")).toHaveTextContent("Fant ingen grunnkrets her.");
  });
});
