import { XYZLayer } from "@/components/Map/XYZLayer";
import { Link as RouterLink } from "@tanstack/react-router";
import { Button, Heading } from "@kv-designsystem/react";
import { ArrowLeftIcon } from "@navikt/aksel-icons";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Map as OlMap } from "@/components/Map/_Map";
import { MapDrawing } from "@/components/Map/Drawing";
import { MatrikkelenhetClick } from "@/components/MatrikkelenhetClick";

export function MapPage() {
  const norgeskartTileUrl =
    "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png";

  return (
    <div className="map">
      <Heading level={1} className="map-title">
        Kart
      </Heading>
      <OlMap>
        <XYZLayer tileUrl={norgeskartTileUrl} />
        <Toolbar>
          <MapDrawing />
          <MatrikkelenhetClick />
          {/* Additional toggle buttons can be added here */}
        </Toolbar>
      </OlMap>
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
