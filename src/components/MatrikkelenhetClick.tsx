import { Tooltip } from "@kv-designsystem/react";
import { ToggleButton } from "./ToggleButton/ToggleButton";
import { NotePencilDashIcon } from "@navikt/aksel-icons";
import { useEffect, useState } from "react";
import { useMap } from "./Map/MapContext";
import { Feature, type MapBrowserEvent } from "ol";
import type { Coordinate } from "ol/coordinate";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Fill from "ol/style/Fill";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Polygon from "ol/geom/Polygon";

type EiendomResponse = {
  geometry: {
    type: "Polygon";
    coordinates: Coordinate[][];
  };
  type: string;
  properties: {
    bruksnummer: number;
    festenummer: number;
    gardsnummer: number;
    hovedområde: boolean;
    kommunenummer: string;
    lokalid: number;
    matrikkelnummertekst: string;
    meterFraPunkt: number;
    nøyaktighetsklasseteig: string;
    objekttype: string;
    oppdateringsdato: string;
    seksjonsnummer: number;
    teigmedflerematrikkelenheter: boolean;
    uregistrertjordsameie: boolean;
  };
};

export function MatrikkelenhetClick() {
  const [isEnhetClickActive, setIsEnhetClickActive] = useState(false);
  return (
    <>
      <Tooltip content={`Skru ${isEnhetClickActive ? "av" : "på"} henting av matrikkelenheter`}>
        <ToggleButton isActive={isEnhetClickActive} onToggle={setIsEnhetClickActive}>
          <NotePencilDashIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      {isEnhetClickActive && <MapClickInteraction />}
    </>
  );
}

function MapClickInteraction() {
  const map = useMap();
  const [teiger, setTeiger] = useState<EiendomResponse["geometry"][]>([]);

  async function fetchGeoJSON(coordinates: Coordinate): Promise<EiendomResponse | undefined> {
    const url = `https://api.kartverket.no/eiendom/v1/punkt/omrader?ost=${coordinates[0]}&nord=${coordinates[1]}&koordsys=3857&utkoordsys=3857`;
    const res = await fetch(url);
    const data = (await res.json()) as { crs: any; features: EiendomResponse[] };
    if (!data.features || data.features.length === 0) {
      return undefined;
    }
    return data.features.at(0);
  }

  const source = new VectorSource();
  useEffect(() => {
    const layer = new VectorLayer({
      source,
      style: new Style({
        fill: new Fill({ color: "rgba(26,131,59,0.2" }),
        stroke: new Stroke({ color: "#1a833b", width: 3 }),
      }),
    });
    map.addLayer(layer);

    async function handleMapClick(e: MapBrowserEvent) {
      const coordinates = e.coordinate;
      const data = await fetchGeoJSON(coordinates);
      if (!data) {
        console.log("No features found at clicked location");
        return;
      }

      setTeiger((prev) => [...prev, data.geometry]);
    }

    map.on("click", handleMapClick);
    return () => {
      map.un("click", handleMapClick);
      map.removeLayer(layer);
    };
  });
  return teiger.map((geometry, index) => <Teig key={index} geometry={geometry} source={source} />);
}

function Teig({
  geometry,
  source,
}: {
  geometry: EiendomResponse["geometry"];
  source: VectorSource;
}) {
  useEffect(() => {
    const feature = new Feature({
      geometry: new Polygon(geometry.coordinates),
    });
    source.addFeature(feature);
    return () => {
      source.removeFeature(feature);
    };
  }, [geometry, source]);

  return null;
}
