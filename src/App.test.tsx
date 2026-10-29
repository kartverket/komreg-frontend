import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TeigResponse } from "./types/TeigResponse";
import { createRegulering, REGULERINGER_STORAGE_KEY } from "./api/reguleringer";
import { useMatrikkelenheter } from "./hooks/useMatrikkelenheter";
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

function selectMatrikkelenhet() {
  useMatrikkelenheter
    .getState()
    .addMatrikkelenhet("0301/1/1", { id: "0301/1/1", features: [selectedTeig] });
}

// Svarer som eiendoms-API-ets geokoding: treff for matrikkelnumrene som finnes i til kommune.
// Teig-WFS-en (hele gårdsnumre) får alltid et tomt svar.
function stubEksisterendeMatrikkelnumre(...eksisterende: string[]) {
  const tomWfs =
    '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"></wfs:FeatureCollection>';
  const fetchMock = vi
    .fn<(url: string) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>>()
    .mockImplementation((url) => {
      const params = new URL(url).searchParams;
      const nummer = `${params.get("gardsnummer")}/${params.get("bruksnummer")}`;
      const features = eksisterende.includes(nummer) ? [{}] : [];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ features }),
        text: () => Promise.resolve(tomWfs),
      });
    });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillInAndSubmit() {
  await userEvent.type(await screen.findByRole("textbox", { name: "Navn" }), "Ny regulering");
  await userEvent.type(screen.getByLabelText("Ikrafttredelsesdato"), "2026-10-21");
  await userEvent.type(screen.getByRole("textbox", { name: "Til kommune" }), "0302");
  await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));
}

describe("App", () => {
  beforeEach(() => {
    useMatrikkelenheter.getState().clearMatrikkelenheter();
    localStorage.removeItem(REGULERINGER_STORAGE_KEY);
    stubEksisterendeMatrikkelnumre();
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
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("heading", { level: 1, name: "Ny regulering" })).toBeVisible();
    expect(screen.getByText("0301 → 0302")).toBeVisible();
    expect(screen.getByRole("row", { name: "1 1 1 Uendret" })).toBeVisible();
  });

  it("saves a new matrikkelnummer in til kommune", async () => {
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Nytt gårdsnummer for 0301-1/1" }),
      "201",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Nytt bruksnummer for 0301-1/1" }),
      "5",
    );
    await fillInAndSubmit();

    expect(await screen.findByRole("row", { name: "1 1 1 201/5" })).toBeVisible();
  });

  it("rejects a new matrikkelnummer that is not a positive integer", async () => {
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Nytt gårdsnummer for 0301-1/1" }),
      "abc",
    );
    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("positive heltall");
  });

  it("rejects a matrikkelnummer that already exists in til kommune", async () => {
    stubEksisterendeMatrikkelnumre("1/1", "1/2");
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "0301-1/1 får 1/1, som allerede finnes i 0302",
    );
    expect(useMatrikkelenheter.getState().matrikkelenheter.has("0301/1/1")).toBe(true);
  });

  it("accepts a new matrikkelnummer that is free in til kommune", async () => {
    const fetchMock = stubEksisterendeMatrikkelnumre("1/1", "1/2");
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Nytt bruksnummer for 0301-1/1" }),
      "3",
    );
    await fillInAndSubmit();

    expect(await screen.findByRole("row", { name: "1 1 1 1/3" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not create the regulation when the matrikkel check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Nettverksfeil")));
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Kunne ikke sjekke");
    expect(localStorage.getItem(REGULERINGER_STORAGE_KEY)).toBeNull();
  });

  it("moves a whole gårdsnummer when chosen", async () => {
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Flytt hele gårdsnummer 0301-1" }),
    );
    await fillInAndSubmit();

    expect(await screen.findByRole("cell", { name: "Hele gårdsnummeret" })).toBeVisible();
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

    await userEvent.click(screen.getByRole("link", { name: "Tilbake til reguleringer" }));
    expect(await screen.findByRole("table")).toBeVisible();
  });

  it("keeps selected parcels when creation fails", async () => {
    selectMatrikkelenhet();
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("Lagring feilet");
    });
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("kunne ikke lagres lokalt");
    expect(useMatrikkelenheter.getState().matrikkelenheter.has("0301/1/1")).toBe(true);
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
