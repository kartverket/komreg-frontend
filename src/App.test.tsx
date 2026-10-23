import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TeigResponse } from "./types/TeigResponse";
import { createRegulering, REGULERINGER_STORAGE_KEY } from "./api/reguleringer";
import { useTeiger } from "./hooks/useTeiger";
import { App } from "./App";

function renderAt(path: string) {
  return render(<App history={createMemoryHistory({ initialEntries: [path] })} />);
}

const selectedTeig: TeigResponse = {
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [] },
  properties: {
    bruksnummer: 1,
    festenummer: 0,
    gardsnummer: 1,
    hovedområde: true,
    kommunenummer: "0301",
    lokalid: 123,
    matrikkelnummertekst: "0301-1/1",
    meterFraPunkt: 0,
    nøyaktighetsklasseteig: "god",
    objekttype: "Teig",
    oppdateringsdato: "2026-10-21",
    seksjonsnummer: 0,
    teigmedflerematrikkelenheter: false,
    uregistrertjordsameie: false,
  },
};

describe("App", () => {
  beforeEach(() => {
    useTeiger.getState().clearTeiger();
    localStorage.removeItem(REGULERINGER_STORAGE_KEY);
  });

  it("renders the front page with the nav", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "KomReg" })).toBeVisible();
    expect(screen.getByRole("navigation")).toBeVisible();
  });

  it("shows the map full screen, without the nav, and goes back", async () => {
    renderAt("/kart");
    expect(await screen.findByRole("region", { name: "Kart over Norge" })).toBeInTheDocument();
    // Visually hidden, but the page still has an h1 for screen readers.
    expect(screen.getByRole("heading", { level: 1, name: "Kart" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Forsiden" }));
    expect(await screen.findByRole("heading", { level: 1, name: "KomReg" })).toBeVisible();
  });

  it("selects map layers from the toolbar", async () => {
    renderAt("/kart");

    await userEvent.click(await screen.findByRole("button", { name: "Velg kartlag" }));
    const propertyBoundaries = screen.getByRole("button", {
      name: "Eiendomsgrenser",
      hidden: true,
    });
    expect(propertyBoundaries).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(propertyBoundaries);
    expect(propertyBoundaries).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a not-found page for an unknown path", async () => {
    renderAt("/finnes-ikke");
    expect(await screen.findByRole("heading", { name: "Fant ikke siden" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Gå til forsiden" })).toBeVisible();
  });

  it("opens the regulation details after creating a regulation", async () => {
    useTeiger.getState().addTeig(selectedTeig.properties.lokalid, selectedTeig);
    renderAt("/reguleringer/ny");

    await userEvent.type(await screen.findByRole("textbox", { name: "Navn" }), "Ny regulering");
    await userEvent.type(screen.getByLabelText("Ikrafttredelsesdato"), "2026-10-21");
    await userEvent.type(screen.getByRole("textbox", { name: "Til kommune" }), "0302");
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Ny regulering" })).toBeVisible();
    expect(screen.getByText("0301 → 0302")).toBeVisible();
  });

  it("shows saved regulations in a table", async () => {
    await createRegulering({
      navn: "Lagret regulering",
      dato: "2026-10-21",
      grensejustering: {
        fraKommunenummer: "0301",
        tilKommunenummer: "0302",
        matrikkelenheter: [],
      },
    });

    renderAt("/reguleringer");

    expect(await screen.findByRole("table")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Fra kommune" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Lagret regulering" })).toBeVisible();

    await userEvent.click(screen.getByRole("cell", { name: "0301" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Lagret regulering" }),
    ).toBeVisible();
  });

  it("keeps selected parcels when creation fails", async () => {
    useTeiger.getState().addTeig(selectedTeig.properties.lokalid, selectedTeig);
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("Lagring feilet");
    });
    renderAt("/reguleringer/ny");

    await userEvent.type(await screen.findByRole("textbox", { name: "Navn" }), "Ny regulering");
    await userEvent.type(screen.getByLabelText("Ikrafttredelsesdato"), "2026-10-21");
    await userEvent.type(screen.getByRole("textbox", { name: "Til kommune" }), "0302");
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("kunne ikke lagres lokalt");
    expect(useTeiger.getState().teiger.has(selectedTeig.properties.lokalid)).toBe(true);
  });

  it("shows our error page, with the nav, when a page throws", async () => {
    // OpenLayers creates its ResizeObserver when the map is built, so this makes /kart throw.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          throw new Error("kartet feilet");
        }
      },
    );
    // React logs every error an error boundary catches; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/kart");
    expect(await screen.findByRole("heading", { name: "Noe gikk galt" })).toBeVisible();
    expect(screen.getByRole("navigation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Last inn siden på nytt" })).toBeVisible();
  });
});
