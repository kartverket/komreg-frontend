import { Fragment, useState } from "react";
import { Dropdown, Tooltip } from "@kv-designsystem/react";
import { LayersIcon } from "@navikt/aksel-icons";
import { WMSLayer } from "@/components/Map/WMSLayer";
import styles from "./MapLayerSelect.module.css";

type WMSSource = {
  layers: string;
  minZoom: number;
};

type LayerOption = {
  id: string;
  label: string;
  url: string;
  sources: WMSSource[];
  className?: string;
};

const administrativeUnitsUrl = "https://wms.geonorge.no/skwms1/wms.adm_enheter2";

const layerOptions: LayerOption[] = [
  {
    id: "fylke",
    label: "Fylkesgrenser",
    url: administrativeUnitsUrl,
    sources: [{ layers: "fylker_gjel", minZoom: 0 }],
  },
  {
    id: "kommune",
    label: "Kommunegrenser",
    url: administrativeUnitsUrl,
    sources: [{ layers: "kommuner_gjel", minZoom: 7 }],
  },
  {
    id: "grunnkrets",
    label: "Grunnkrets",
    url: "https://wms.geonorge.no/skwms1/wms.grunnkretser",
    sources: [{ layers: "Grunnkretser,Grunnkretsnummer", minZoom: 11 }],
  },
  {
    id: "eiendom",
    label: "Eiendomsgrenser",
    url: "https://wms.geonorge.no/skwms1/wms.matrikkel",
    className: "ol-layer-eiendom",
    sources: [
      { layers: "eiendomsgrense", minZoom: 13 },
      { layers: "eiendoms_id", minZoom: 15 },
    ],
  },
  {
    id: "postnummer",
    label: "Postnummerområder",
    url: "https://wms.geonorge.no/skwms1/wms.postnummeromrader",
    sources: [{ layers: "postnummer", minZoom: 9 }],
  },
];

export function MapLayerSelect() {
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const hasVisibleLayers = layerOptions.some((option) => visibleLayers[option.id]);

  return (
    <>
      <Dropdown.TriggerContext>
        <Tooltip content="Velg kartlag">
          <Dropdown.Trigger
            data-icon="true"
            aria-label="Velg kartlag"
            aria-pressed={hasVisibleLayers}
            variant="tertiary"
          >
            <LayersIcon aria-hidden />
          </Dropdown.Trigger>
        </Tooltip>
        <Dropdown placement="top-start" autoPlacement={false} className={styles.dropdown}>
          <Dropdown.List aria-label="Kartlag">
            {layerOptions.map((option) => (
              <Dropdown.Item key={option.id}>
                <Dropdown.Button
                  className={styles.option}
                  aria-pressed={visibleLayers[option.id] ?? false}
                  onClick={() =>
                    setVisibleLayers((current) => ({
                      ...current,
                      [option.id]: !current[option.id],
                    }))
                  }
                >
                  {option.label}
                </Dropdown.Button>
              </Dropdown.Item>
            ))}
          </Dropdown.List>
        </Dropdown>
      </Dropdown.TriggerContext>
      {layerOptions.map((option) =>
        visibleLayers[option.id] ? (
          <Fragment key={option.id}>
            {option.sources.map((source) => (
              <WMSLayer
                key={source.layers}
                className={option.className}
                layers={source.layers}
                minZoom={source.minZoom}
                url={option.url}
              />
            ))}
          </Fragment>
        ) : null,
      )}
    </>
  );
}
