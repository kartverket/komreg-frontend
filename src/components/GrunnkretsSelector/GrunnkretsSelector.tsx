import { Button, Tooltip } from "@kv-designsystem/react";
import { HexagonGridIcon } from "@navikt/aksel-icons";
import { useEffect, useState } from "react";
import { Feature, type MapBrowserEvent } from "ol";
import MultiPolygon from "ol/geom/MultiPolygon";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import { ToggleButton } from "../ToggleButton/ToggleButton";
import { useMap } from "../Map/MapContext";
import { VectorLayer } from "../Map/VectorLayer";
import { useVectorSource } from "../Map/VectorLayerContext";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";
import {
  getGrunnkretsAtPoint,
  getMatrikkelenheterInGrunnkrets,
  type ReguleringApiGrunnkrets,
} from "@/utils/TeigUtils";
import styles from "./GrunnkretsSelector.module.css";

const kretsOutlineStyle = new Style({
  fill: new Fill({ color: "rgba(26,88,159,0.08)" }),
  stroke: new Stroke({ color: "#1a589f", width: 3, lineDash: [8, 6] }),
});

export function GrunnkretsSelector({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  return (
    <div className={styles.tool}>
      <Tooltip content={`Skru ${isActive ? "av" : "på"} henting av grunnkrets`}>
        <ToggleButton
          isActive={isActive}
          onToggle={onToggle}
          data-testid="grunnkrets-selector-toggle-button"
        >
          <HexagonGridIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
      {/* Egen komponent, så valgt krets og tilbakemelding nullstilles når verktøyet skrus av */}
      {isActive && <ActiveGrunnkretsSelector />}
    </div>
  );
}

function ActiveGrunnkretsSelector() {
  const [krets, setKrets] = useState<ReguleringApiGrunnkrets | null>(null);
  const [isFetchingTeiger, setIsFetchingTeiger] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function fetchTeiger(selected: ReguleringApiGrunnkrets) {
    setIsFetchingTeiger(true);
    try {
      const matrikkelenheter = await getMatrikkelenheterInGrunnkrets(selected.id);
      matrikkelenheter.forEach((enhet) => {
        useMatrikkelenheter.getState().addMatrikkelenhet(enhet.id, enhet);
      });
      const outside = new Set(
        matrikkelenheter
          .flatMap((enhet) => enhet.features)
          .filter((teig) => teig.properties.inKrets === false)
          .map((teig) => teig.properties.lokalid),
      ).size;
      setFeedback(
        `Hentet ${matrikkelenheter.length} matrikkelenheter i ${selected.properties.kretsnavn}.` +
          (outside > 0 ? ` ${outside} teiger ligger utenfor kretsen.` : ""),
      );
      setKrets(null);
    } catch (error) {
      console.error("Failed to retrieve teiger in grunnkrets", error);
      setFeedback("Kunne ikke hente teigene i kretsen.");
    } finally {
      setIsFetchingTeiger(false);
    }
  }

  return (
    <>
      {(krets || feedback) && (
        <div className={styles.panel}>
          {feedback && <p role="status">{feedback}</p>}
          {krets && (
            <>
              <p>
                {krets.properties.kretsnavn} (krets {krets.properties.kretsnummer} i kommune{" "}
                {krets.properties.municipalityNumber})
              </p>
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  data-size="sm"
                  disabled={isFetchingTeiger}
                  onClick={() => setKrets(null)}
                >
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  data-size="sm"
                  disabled={isFetchingTeiger}
                  onClick={() => void fetchTeiger(krets)}
                >
                  {isFetchingTeiger ? "Henter teiger …" : "Hent teiger"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <VectorLayer style={kretsOutlineStyle}>
        {krets && <KretsOutline krets={krets} />}
        {!isFetchingTeiger && (
          <MapClickInteraction
            onKrets={(found) => {
              setKrets(found ?? null);
              setFeedback(found ? null : "Fant ingen grunnkrets her.");
            }}
            onError={() => setFeedback("Kunne ikke hente grunnkretsen.")}
          />
        )}
      </VectorLayer>
    </>
  );
}

function MapClickInteraction({
  onKrets,
  onError,
}: {
  onKrets: (krets: ReguleringApiGrunnkrets | undefined) => void;
  onError: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    let active = true;

    async function handleMapClick(e: MapBrowserEvent) {
      const viewport = map.getViewport();
      if (viewport) viewport.style.cursor = "wait";
      try {
        const krets = await getGrunnkretsAtPoint(e.coordinate);
        if (active) onKrets(krets);
      } catch (error) {
        console.error("Failed to retrieve grunnkrets", error);
        if (active) onError();
      } finally {
        if (viewport) viewport.style.cursor = "";
      }
    }

    map.on("click", handleMapClick);
    return () => {
      active = false;
      map.un("click", handleMapClick);
    };
  }, [map, onKrets, onError]);

  return null;
}

function KretsOutline({ krets }: { krets: ReguleringApiGrunnkrets }) {
  const source = useVectorSource();
  useEffect(() => {
    const feature = new Feature(
      // Regulering-API-et gir koordinater i EPSG:32633
      new MultiPolygon(krets.geometry.coordinates).transform("EPSG:32633", "EPSG:3857"),
    );
    source.addFeature(feature);
    return () => {
      source.removeFeature(feature);
    };
  }, [krets, source]);

  return null;
}
