import { XYZLayer } from "@/components/Map/XYZLayer";
import { Link as RouterLink } from "@tanstack/react-router";
import { Button, Heading } from "@kv-designsystem/react";
import { ArrowLeftIcon } from "@navikt/aksel-icons";
import { Toolbar } from "@/components/Toolbar/Toolbar";

import { Map } from "@/components/Map/_Map";
import { MapDrawing } from "@/components/Map/Drawing";
import { MapLayerSelect } from "@/components/MapLayerSelect/MapLayerSelect";

export function MapPage() {
  const norgeskartTileUrl =
    "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png";

  return (
    <div className="map">
      <Heading level={1} className="map-title">
        Kart
      </Heading>
      <Map>
        <XYZLayer tileUrl={norgeskartTileUrl} />
        <Toolbar>
          <MapDrawing />
          <MapLayerSelect />
        </Toolbar>
      </Map>
      <div className="map-panel">
        <Button asChild variant="primary" data-size="sm">
          <RouterLink to="/">
            <ArrowLeftIcon aria-hidden />
            Forsiden
          </RouterLink>
        </Button>
      </div>
    </div>
  );
}
