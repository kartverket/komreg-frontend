import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "../ToggleButton/ToggleButton";
import { NotePencilDashIcon } from "@navikt/aksel-icons";
import { useEffect } from "react";
import { useMap } from "../Map/MapContext";
import { Feature, type MapBrowserEvent } from "ol";
import Fill from "ol/style/Fill";
import Style, { type StyleFunction } from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Polygon from "ol/geom/Polygon";
import type VectorSource from "ol/source/Vector";
import type { Coordinate } from "ol/coordinate";
import { VectorLayer } from "../Map/VectorLayer";
import { useVectorSource } from "../Map/VectorLayerContext";
import { getMatrikkelenheterConnectedToTeigAtPoint } from "@/utils/TeigUtils";
import type { Teig } from "@/types/TeigResponse";
import type { Matrikkelenhet } from "@/types/Matrikkelenhet";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import type { Address } from "@/types/Address";
import Point from "ol/geom/Point";
import CircleStyle from "ol/style/Circle";
import Text from "ol/style/Text";

const matrikkelenhetLayerStyle = new Style({
  fill: new Fill({ color: "rgba(26,131,59,0.2)" }),
  stroke: new Stroke({ color: "#1a833b", width: 3 }),
});

export function MatrikkelenhetSelector({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  const { matrikkelenheter } = useMatrikkelenheter();
  return (
    <>
      <Tooltip content={`Skru ${isActive ? "av" : "på"} henting av matrikkelenheter`}>
        <ToggleButton
          isActive={isActive}
          onToggle={onToggle}
          data-testid="matrikkelenhet-selector-toggle-button"
        >
          <NotePencilDashIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      <VectorLayer style={matrikkelenhetLayerStyle}>
        {Array.from(matrikkelenheter.values()).map((matrikkelenhet) => (
          <Matrikkelenhet key={matrikkelenhet.id} enhet={matrikkelenhet} />
        ))}
        {isActive && <MapClickInteraction />}
      </VectorLayer>
    </>
  );
}

async function withWaitCursor<T>(map: ReturnType<typeof useMap>, fn: () => Promise<T>): Promise<T> {
  const viewport = map.getViewport();
  if (!viewport) return fn();
  viewport.style.cursor = "wait";
  try {
    return await fn();
  } finally {
    viewport.style.cursor = "";
  }
}

const MATRIKKELENHET_ID_KEY = "matrikkelenhetId";

function getMatrikkelenhetIdAtCoordinate(source: VectorSource, coordinate: Coordinate) {
  return source.getFeaturesAtCoordinate(coordinate).at(0)?.get(MATRIKKELENHET_ID_KEY) as
    | string
    | undefined;
}

function MapClickInteraction() {
  const map = useMap();
  const source = useVectorSource();

  useEffect(() => {
    let active = true;

    async function handleMapClick(e: MapBrowserEvent) {
      const existingEnhetAtPoint = getMatrikkelenhetIdAtCoordinate(source, e.coordinate);
      if (existingEnhetAtPoint) {
        useMatrikkelenheter.getState().removeMatrikkelenhet(existingEnhetAtPoint);
        return;
      }

      let res: Matrikkelenhet[] | undefined;
      try {
        res = await withWaitCursor(map, () =>
          getMatrikkelenheterConnectedToTeigAtPoint(e.coordinate),
        );
      } catch (error) {
        console.error("Failed to retrieve matrikkelenhet", error);
        return;
      }

      if (res && active) {
        res.forEach((matrikkelenhet) => {
          useMatrikkelenheter.getState().addMatrikkelenhet(matrikkelenhet.id, matrikkelenhet);
        });
      }
    }

    map.on("click", handleMapClick);
    return () => {
      active = false;
      map.un("click", handleMapClick);
    };
  }, [map, source]);

  return null;
}

function Matrikkelenhet({ enhet }: { enhet: Matrikkelenhet }) {
  return (
    <>
      {enhet.addresses
        ?.filter(
          (address) =>
            address.representasjonspunkt?.lon !== undefined &&
            address.representasjonspunkt?.lat !== undefined,
        )
        .map((address) => (
          <AddressComponent
            key={
              "add:" +
              (address.kommunenummer ?? "") +
              (address.adressekode ?? "") +
              (address.nummer ?? "") +
              (address.bokstav ?? "")
            }
            address={address}
          />
        ))}
      {enhet.features.map((teig) => (
        <Teig
          key={"teig:" + teig.properties.parcelId}
          geometry={teig.geometry}
          enhetId={enhet.id}
        />
      ))}
    </>
  );
}

function Teig({ geometry, enhetId }: { geometry: Teig["geometry"]; enhetId: string }) {
  const source = useVectorSource();
  useEffect(() => {
    const feature = new Feature({
      geometry: new Polygon(geometry.coordinates).transform("EPSG:32633", "EPSG:3857"), //Regulerings api returns coordinates in EPSG:32633
      [MATRIKKELENHET_ID_KEY]: enhetId,
    });
    source.addFeature(feature);
    return () => {
      source.removeFeature(feature);
    };
  }, [geometry, enhetId, source]);

  return null;
}
function AddressComponent({ address }: { address: Address }) {
  const MAX_RESOLUTION_FOR_LABEL = 10;
  const source = useVectorSource();
  useEffect(() => {
    const addressStyle: StyleFunction = (_feature, resolution) =>
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#fff" }),
          stroke: new Stroke({ color: "#1A589F", width: 4 }),
        }),
        text:
          resolution <= MAX_RESOLUTION_FOR_LABEL
            ? new Text({
                text: address.adressetekst,
                fill: new Fill({ color: "#fff" }),
                stroke: new Stroke({ color: "#2b2e33", width: 3 }),
                font: "12px system-ui, sans-serif",
                offsetY: -12,
              })
            : undefined,
      });

    const { lon, lat } = address.representasjonspunkt!;
    const point = new Point([lon, lat]);

    if (address.representasjonspunkt?.epsg !== "3857") {
      point.transform("EPSG:" + address.representasjonspunkt?.epsg, "EPSG:3857");
    }

    const feature = new Feature(point);
    feature.setStyle(addressStyle);
    source.addFeature(feature);
    return () => {
      source.removeFeature(feature);
    };
  }, [address, source]);
  return null;
}
