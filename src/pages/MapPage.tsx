import { XYZLayer } from "@/components/Map/XYZLayer";
import { Link as RouterLink, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Heading } from "@kv-designsystem/react";
import { ArrowLeftIcon } from "@navikt/aksel-icons";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Map as OlMap } from "@/components/Map/_Map";
import { MapSearch } from "@/components/Toolbar/MapSearch";
import { MapDrawing } from "@/components/Map/Drawing";
import { MatrikkelenhetSelector } from "@/components/MatrikkelenhetSelector/MatrikkelenhetSelector";
import { GrunnkretsSelector } from "@/components/GrunnkretsSelector/GrunnkretsSelector";
import { useState } from "react";
import { MapLayerSelect } from "@/components/MapLayerSelect/MapLayerSelect";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";

export function MapPage() {
  const [activeTool, setActiveTool] = useState<"drawing" | "parcel" | "krets" | null>(null);
  const { lat, lon, zoom } = useSearch({ from: "/kart" });
  const navigate = useNavigate();
  const initialPosition =
    lat !== undefined && lon !== undefined && zoom !== undefined ? { lat, lon, zoom } : undefined;
  const selectedCount = useMatrikkelenheter((state) => state.matrikkelenheter.size);
  const norgeskartTileUrl =
    "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png";

  return (
    <div className="map">
      <Heading level={1} className="map-title">
        Kart
      </Heading>
      <OlMap
        initialPosition={initialPosition}
        onPositionChange={(position) =>
          void navigate({ to: "/kart", search: position, replace: true })
        }
      >
        <XYZLayer tileUrl={norgeskartTileUrl} />
        <Toolbar>
          <MapDrawing
            isActive={activeTool === "drawing"}
            onToggle={(isActive) => setActiveTool(isActive ? "drawing" : null)}
          />
          <MatrikkelenhetSelector
            isActive={activeTool === "parcel"}
            onToggle={(isActive) => setActiveTool(isActive ? "parcel" : null)}
          />
          <GrunnkretsSelector
            isActive={activeTool === "krets"}
            onToggle={(isActive) => setActiveTool(isActive ? "krets" : null)}
          />
          <MapSearch />
          <MapLayerSelect />
        </Toolbar>
      </OlMap>
      <div className="map-panel">
        <div className="map-actions">
          {selectedCount ? (
            <Button asChild variant="primary" data-size="sm">
              <RouterLink to="/reguleringer/ny">
                Opprett grensejustering ({selectedCount})
              </RouterLink>
            </Button>
          ) : (
            <Button variant="primary" data-size="sm" disabled>
              Opprett grensejustering (0)
            </Button>
          )}
          <Button asChild variant="secondary" data-size="sm">
            <RouterLink to="/">
              <ArrowLeftIcon aria-hidden />
              Forsiden
            </RouterLink>
          </Button>
        </div>
      </div>
    </div>
  );
}
