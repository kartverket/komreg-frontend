import { useEffect, useRef, useState } from "react";
import { Button, Textfield, Tooltip } from "@kv-designsystem/react";
import { MagnifyingGlassIcon } from "@navikt/aksel-icons";
import { boundingExtent } from "ol/extent";
import { useMap } from "@/components/Map/MapContext";
import { ToggleButton } from "@/components/ToggleButton/ToggleButton";
import { parseSearchTarget } from "./MapSearch.utils";
import styles from "./MapSearch.module.css";

type KommuneResponse = {
  avgrensningsboks?: { coordinates?: unknown };
};

type EiendomResponse = {
  features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
};

const FORMAT_ERROR = "Skriv kommunenummer (3322) eller matrikkelnummer (3322-123/1).";

function coordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2) {
    const x = typeof value[0] === "string" ? Number(value[0]) : value[0];
    const y = typeof value[1] === "string" ? Number(value[1]) : value[1];
    if (
      typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y)
    ) {
      return [[x, y]];
    }
  }
  return value.flatMap(coordinates);
}

export function MapSearch() {
  const map = useMap();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        setIsOpen((open) => !open);
      } else if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function search() {
    const target = parseSearchTarget(value);
    if (!target) {
      setFeedback(FORMAT_ERROR);
      return;
    }

    setIsLoading(true);
    setFeedback("");
    try {
      if (target.type === "kommune") {
        const response = await fetch(
          `https://api.kartverket.no/kommuneinfo/v1/kommuner/${target.kommunenummer}?utkoordsys=3857`,
        );
        if (response.status === 404) {
          setFeedback(`Fant ikke kommune ${target.kommunenummer}.`);
          return;
        }
        if (!response.ok) throw new Error(`Kommuneoppslaget feilet (${response.status})`);
        const data = (await response.json()) as KommuneResponse;
        const points = coordinates(data.avgrensningsboks?.coordinates);
        if (!points.length) throw new Error("Kommunen mangler kartavgrensning");
        map.getView().fit(boundingExtent(points), { duration: 400, padding: [40, 40, 40, 40] });
        setFeedback(`Viser kommune ${target.kommunenummer}.`);
        return;
      }

      const params = new URLSearchParams({
        kommunenummer: target.kommunenummer,
        gardsnummer: target.gardsnummer,
        bruksnummer: target.bruksnummer,
        utkoordsys: "3857",
      });
      if (target.festenummer) params.set("festenummer", target.festenummer);
      const response = await fetch(`https://api.kartverket.no/eiendom/v1/geokoding?${params}`);
      if (!response.ok) throw new Error(`Eiendomsoppslaget feilet (${response.status})`);
      const data = (await response.json()) as EiendomResponse;
      const point = data.features
        ?.filter((feature) => feature.geometry?.type === "Point")
        .flatMap((feature) => coordinates(feature.geometry?.coordinates))[0];
      if (!point) {
        setFeedback("Fant ingen eiendom med dette matrikkelnummeret.");
        return;
      }
      map.getView().animate({ center: point, zoom: 16, duration: 400 });
      setFeedback(`Viser ${value.trim()}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Søket feilet. Prøv igjen.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.searchTool}>
      {isOpen && (
        <form
          className={styles.searchPanel}
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <Textfield
            ref={inputRef}
            label="Finn i kartet"
            description="Kommunenummer eller matrikkelnummer"
            placeholder="3322 eller 3322-123/1"
            value={value}
            error={
              feedback.startsWith("Skriv") || feedback.startsWith("Fant ikke")
                ? feedback
                : undefined
            }
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback("");
            }}
          />
          {feedback && !feedback.startsWith("Skriv") && !feedback.startsWith("Fant ikke") && (
            <p className={styles.feedback} aria-live="polite">
              {feedback}
            </p>
          )}
          <Button type="submit" data-size="sm" disabled={isLoading}>
            <MagnifyingGlassIcon aria-hidden />
            {isLoading ? "Søker …" : "Søk"}
          </Button>
        </form>
      )}
      <Tooltip content="Finn i kartet (Ctrl/⌘ + Enter)">
        <ToggleButton
          isActive={isOpen}
          onToggle={setIsOpen}
          aria-label="Finn i kartet"
          aria-expanded={isOpen}
        >
          <MagnifyingGlassIcon fontSize="1.5rem" aria-hidden />
        </ToggleButton>
      </Tooltip>
    </div>
  );
}
