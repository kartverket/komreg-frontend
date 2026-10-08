import { useEffect, useRef } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import { Button, Heading } from "@kv-designsystem/react";
import { ArrowLeftIcon } from "@navikt/aksel-icons";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { defaults as defaultControls } from "ol/control/defaults";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";

const tileUrl =
  "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png";

export function MapPage() {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new OlMap({
      target: targetRef.current!,
      layers: [new TileLayer({ source: new XYZ({ url: tileUrl, attributions: "© Kartverket" }) })],
      view: new View({ center: fromLonLat([15, 65]), zoom: 4, maxZoom: 18 }),
      controls: defaultControls({ attributionOptions: { collapsible: false } }),
    });
    return () => map.dispose();
  }, []);

  return (
    <div className="map">
      <Heading level={1} className="map-title">
        Kart
      </Heading>
      <div ref={targetRef} className="map-surface" role="region" aria-label="Kart over Norge" />
      <div className="map-panel">
        <Button asChild variant="secondary" data-size="sm">
          <RouterLink to="/">
            <ArrowLeftIcon aria-hidden />
            Forsiden
          </RouterLink>
        </Button>
      </div>
    </div>
  );
}
