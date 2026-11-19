import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Teig } from "./types/TeigResponse";
import { createRegulering } from "./api/reguleringer";
import type { GrensejusteringDraft, OpprettReguleringRequest } from "./domain/regulering";
import { useMatrikkelenheter } from "./hooks/useMatrikkelenheter";
import { App } from "./App";

const lagrede = vi.hoisted(() => ({ liste: [] as OpprettReguleringRequest[], feilNeste: false }));

vi.mock("./api/reguleringer", () => ({
  createRegulering: (request: OpprettReguleringRequest) => {
    if (lagrede.feilNeste) {
      lagrede.feilNeste = false;
      return Promise.reject(new Error("Reguleringen kunne ikke lagres på serveren"));
    }
    lagrede.liste.push(request);
    return Promise.resolve(lagrede.liste.length);
  },
  updateRegulering: (id: number, request: OpprettReguleringRequest) => {
    if (!lagrede.liste[id - 1]) return Promise.reject(new Error("Fant ikke reguleringen"));
    lagrede.liste[id - 1] = request;
    return Promise.resolve();
  },
  getRegulering: (id: number) => {
    const regulering = lagrede.liste[id - 1];
    if (!regulering) return Promise.reject(new Error("Fant ikke reguleringen"));
    return Promise.resolve({ id, ...regulering });
  },
  listReguleringer: () =>
    Promise.resolve(
      lagrede.liste.map((r, i) => ({
        id: i + 1,
        navn: r.navn,
        dato: r.dato,
        fraKommunenummer: r.grensejusteringer[0]?.fraKommunenummer ?? "",
        tilKommunenummer: r.grensejusteringer[0]?.tilKommunenummer ?? "",
      })),
    ),
}));

function renderAt(path: string) {
  return render(<App history={createMemoryHistory({ initialEntries: [path] })} />);
}

const selectedTeig: Teig = {
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [] },
  properties: {
    lokalid: 123456,
  },
};

function selectMatrikkelenhet() {
  useMatrikkelenheter.getState().addMatrikkelenhet("0301/1/1", {
    id: "0301/1/1",
    features: [selectedTeig],
    matrikkelnummer: { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 1 },
  });
}

function selectMatrikkelenhetMedVegadresse() {
  useMatrikkelenheter.getState().addMatrikkelenhet("0301/1/1", {
    id: "0301/1/1",
    features: [selectedTeig],
    matrikkelnummer: { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 1 },
    addresses: [{ kommunenummer: "0301", adressekode: 1234, nummer: 5, adressenavn: "Storgata" }],
  });
}

function selectTeigUtenMatrikkelnummer() {
  const teig: Teig = {
    ...selectedTeig,
    properties: { lokalid: 456 },
  };
  useMatrikkelenheter.getState().addMatrikkelenhet("teig/456", {
    id: "teig/456",
    features: [teig],
    matrikkelnummer: { kommunenummer: "0301", gardsnummer: 0, bruksnummer: 0 },
  });
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

// Adresse-API-et har én veg i til kommune, med adressekode 9999 og de gitte husnumrene. Søk på
// veg og sjekken av husnumre får begge dette svaret. Eiendoms-API-et får ingen treff.
function stubVegITilKommune(adressenavn: string, husnumre: number[]) {
  const adresser = husnumre.map((nummer) => ({
    adressekode: 9999,
    adressenavn,
    nummer,
    bokstav: "",
  }));
  const fetchMock = vi
    .fn<(url: string) => Promise<Pick<Response, "ok" | "status" | "json">>>()
    .mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(url.includes("/adresser/") ? { adresser } : { features: [] }),
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
}

const lagretGrensejustering: GrensejusteringDraft = {
  fraKommunenummer: "0301",
  tilKommunenummer: "0302",
  matrikkelenheter: [
    { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 1, teigIder: [1], nyGardsnummer: 5 },
  ],
  teiger: [],
  vegadresser: [],
};

const lagretRegulering: OpprettReguleringRequest = {
  navn: "Lagret regulering",
  dato: "2026-10-21",
  grensejusteringer: [lagretGrensejustering],
};

async function fillIn() {
  await userEvent.type(await screen.findByRole("textbox", { name: "Navn" }), "Ny regulering");
  await userEvent.type(screen.getByLabelText("Ikrafttredelsesdato"), "2026-10-21");
  await userEvent.type(screen.getByRole("textbox", { name: "Til kommune" }), "0302");
}

async function fillInAndSubmit() {
  await fillIn();
  await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));
}

describe("App", () => {
  beforeEach(() => {
    useMatrikkelenheter.getState().clearMatrikkelenheter();
    lagrede.liste = [];
    lagrede.feilNeste = false;
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
    expect(lagrede.liste).toHaveLength(0);
  });

  it("moves a teig without matrikkelnummer to til kommune", async () => {
    selectTeigUtenMatrikkelnummer();
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("row", { name: "456" })).toBeVisible();
  });

  it("chooses the veg with the same name in til kommune", async () => {
    stubVegITilKommune("Storgata", [1]);
    selectMatrikkelenhetMedVegadresse();
    renderAt("/reguleringer/ny");

    await fillIn();
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(await screen.findByRole("row", { name: "Storgata 5 Storgata 5 9999" })).toBeVisible();
  });

  it("shows a taken husnummer right away and accepts a new one", async () => {
    stubVegITilKommune("Storgata", [5]);
    selectMatrikkelenhetMedVegadresse();
    renderAt("/reguleringer/ny");

    await fillIn();
    expect(await screen.findByRole("cell", { name: "Opptatt" })).toBeVisible();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Nytt husnummer for Storgata 5" }),
      "6",
    );
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(await screen.findByRole("row", { name: "Storgata 5 Storgata 6 9999" })).toBeVisible();
  });

  it("lets the user search for and choose another veg", async () => {
    stubVegITilKommune("Kirkevegen", [1]);
    selectMatrikkelenhetMedVegadresse();
    renderAt("/reguleringer/ny");

    await fillIn();
    await userEvent.type(
      screen.getByRole("combobox", { name: "Veg i til kommune for Storgata (1234)" }),
      "Kirke",
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Kirkevegen (9999)", hidden: true }),
    );
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(await screen.findByRole("row", { name: "Storgata 5 Kirkevegen 5 9999" })).toBeVisible();
  });

  it("lets one vegadresse leave the veg for all, and requires a veg for it", async () => {
    stubVegITilKommune("Storgata", [1]);
    selectMatrikkelenhetMedVegadresse();
    renderAt("/reguleringer/ny");

    await fillIn();
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Velg annen veg for Storgata 5" }));
    expect(
      screen.getByRole("combobox", { name: "Veg i til kommune for Storgata 5" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Velg veg i til kommune for Storgata 5",
    );

    await userEvent.click(screen.getByRole("button", { name: "Bruk felles veg for Storgata 5" }));
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();
  });

  it("requires a veg in til kommune when none has the same name", async () => {
    stubVegITilKommune("Kirkevegen", [1]);
    selectMatrikkelenhetMedVegadresse();
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Velg veg i til kommune for Storgata 5",
    );
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

  it("edits a saved grensejustering without the regulation's navn and dato", async () => {
    const id = await createRegulering(lagretRegulering);
    renderAt(`/reguleringer/${id}/rediger`);

    const gardsnummer = await screen.findByRole("textbox", {
      name: "Nytt gårdsnummer for 0301-1/1",
    });
    expect(screen.getByText("Regulering: Lagret regulering")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Navn" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ikrafttredelsesdato")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Fra kommune" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Til kommune" })).toHaveValue("0302");
    expect(gardsnummer).toHaveValue("5");
    expect(
      screen.queryByRole("checkbox", { name: "Flytt hele gårdsnummer 0301-1" }),
    ).not.toBeInTheDocument();

    await userEvent.clear(gardsnummer);
    await userEvent.type(gardsnummer, "7");
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Lagret regulering" }),
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: "7/1" })).toBeVisible();
    expect(lagrede.liste).toHaveLength(1);
    expect(lagrede.liste[0]).toMatchObject({ navn: "Lagret regulering", dato: "2026-10-21" });
  });

  it("edits the regulation's navn and dato on the details page", async () => {
    const id = await createRegulering(lagretRegulering);
    renderAt(`/reguleringer/${id}`);

    const navn = await screen.findByRole("textbox", { name: "Navn" });
    expect(navn).toHaveValue("Lagret regulering");
    await userEvent.clear(navn);
    await userEvent.type(navn, "Endret regulering");
    const dato = screen.getByLabelText("Ikrafttredelsesdato");
    await userEvent.clear(dato);
    await userEvent.type(dato, "2027-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Lagre navn og dato" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Endret regulering" }),
    ).toBeVisible();
    expect(screen.getByText("Ikrafttredelse: 2027-01-01")).toBeVisible();
    expect(lagrede.liste[0]).toMatchObject({
      navn: "Endret regulering",
      dato: "2027-01-01",
      grensejusteringer: lagretRegulering.grensejusteringer,
    });
  });

  it("keeps the chosen veg and husnummer when editing, and accepts a new husnummer", async () => {
    stubVegITilKommune("Storgata", [1]);
    const id = await createRegulering({
      ...lagretRegulering,
      grensejusteringer: [
        {
          ...lagretGrensejustering,
          vegadresser: [
            {
              kommunenummer: "0301",
              veg: { adressekode: 1234, adressenavn: "Storgata" },
              husnummer: { nummer: 5, bokstav: "" },
              nyVeg: { adressekode: 9999, adressenavn: "Storgata" },
              nyttHusnummer: { nummer: 5, bokstav: "" },
            },
          ],
        },
      ],
    });
    renderAt(`/reguleringer/${id}/rediger`);

    const husnummer = await screen.findByRole("textbox", { name: "Nytt husnummer for Storgata 5" });
    expect(husnummer).toHaveValue("5");
    expect(await screen.findByRole("cell", { name: "Ledig" })).toBeVisible();

    await userEvent.clear(husnummer);
    await userEvent.type(husnummer, "6");
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(await screen.findByRole("row", { name: "Storgata 5 Storgata 6 9999" })).toBeVisible();
  });

  it("does not save an edit that is invalid", async () => {
    const id = await createRegulering(lagretRegulering);
    renderAt(`/reguleringer/${id}/rediger`);

    const til = await screen.findByRole("textbox", { name: "Til kommune" });
    await userEvent.clear(til);
    await userEvent.type(til, "0301");
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fra og til kommune må være forskjellige",
    );
    expect(lagrede.liste).toEqual([lagretRegulering]);
  });

  it("opens the edit page from the regulation details and goes back on cancel", async () => {
    const id = await createRegulering(lagretRegulering);
    renderAt(`/reguleringer/${id}`);

    await userEvent.click(
      await screen.findByRole("link", { name: "Rediger grensejustering 0301 → 0302" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Rediger grensejustering" }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("link", { name: "Avbryt" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Lagret regulering" }),
    ).toBeVisible();
  });

  it("adds the grensejustering to an existing regulation when one is chosen", async () => {
    await createRegulering(lagretRegulering);
    selectMatrikkelenhet();
    renderAt("/reguleringer/ny");

    await userEvent.click(await screen.findByRole("radio", { name: "Lagret regulering" }));
    expect(screen.queryByRole("textbox", { name: "Navn" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Til kommune" }), "0303");
    await userEvent.click(screen.getByRole("button", { name: "Opprett regulering" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Lagret regulering" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "0301 → 0302" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "0301 → 0303" })).toBeVisible();
    expect(lagrede.liste).toHaveLength(1);
    expect(lagrede.liste[0]?.grensejusteringer).toHaveLength(2);
  });

  it("edits one grensejustering and keeps the others", async () => {
    const andre: GrensejusteringDraft = {
      ...lagretGrensejustering,
      tilKommunenummer: "0303",
      matrikkelenheter: [{ kommunenummer: "0301", gardsnummer: 2, bruksnummer: 1, teigIder: [2] }],
    };
    const id = await createRegulering({
      ...lagretRegulering,
      grensejusteringer: [lagretGrensejustering, andre],
    });
    renderAt(`/reguleringer/${id}`);

    await userEvent.click(
      await screen.findByRole("link", { name: "Rediger grensejustering 0301 → 0303" }),
    );
    const gardsnummer = await screen.findByRole("textbox", {
      name: "Nytt gårdsnummer for 0301-2/1",
    });
    expect(screen.getByRole("textbox", { name: "Til kommune" })).toHaveValue("0303");
    await userEvent.type(gardsnummer, "9");
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(await screen.findByRole("cell", { name: "9/1" })).toBeVisible();
    expect(lagrede.liste[0]?.grensejusteringer).toEqual([
      lagretGrensejustering,
      {
        ...andre,
        matrikkelenheter: [
          {
            kommunenummer: "0301",
            gardsnummer: 2,
            bruksnummer: 1,
            teigIder: [2],
            nyGardsnummer: 9,
          },
        ],
      },
    ]);
  });

  it("shows an error when the regulation to edit does not exist", async () => {
    renderAt("/reguleringer/404/rediger");

    expect(await screen.findByRole("alert")).toHaveTextContent("Fant ikke reguleringen");
  });

  it("keeps selected parcels when creation fails", async () => {
    selectMatrikkelenhet();
    lagrede.feilNeste = true;
    renderAt("/reguleringer/ny");

    await fillInAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("kunne ikke lagres på serveren");
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
