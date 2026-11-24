import { describe, expect, it, vi } from "vite-plus/test";
import { tilReformSpec } from "@/domain/reformSpec";
import type { OpprettReguleringRequest } from "@/domain/regulering";
import {
  createRegulering,
  getRegulering,
  listReguleringer,
  updateRegulering,
} from "./reguleringer";

const request: OpprettReguleringRequest = {
  navn: "Grensejustering test",
  dato: "2026-10-21",
  grensejustering: {
    fraKommunenummer: "1525",
    tilKommunenummer: "1508",
    matrikkelenheter: [
      {
        kommunenummer: "1525",
        gardsnummer: 12,
        bruksnummer: 4,
        teigIder: [10, 11],
      },
    ],
    teiger: [{ kommunenummer: "1525", teigId: 12 }],
    vegadresser: [
      {
        kommunenummer: "1525",
        veg: { adressekode: 1234, adressenavn: "Storgata" },
        husnummer: { nummer: 5, bokstav: "A" },
        nyVeg: { adressekode: 5678, adressenavn: "Kirkevegen" },
        nyttHusnummer: { nummer: 7, bokstav: "" },
      },
    ],
  },
};

function mockFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi
    .fn<(url: URL, init?: RequestInit) => Promise<Pick<Response, "ok" | "json" | "status">>>()
    .mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("reguleringer-API", () => {
  it("sender reformSpec og returnerer ID-en fra serveren", async () => {
    const fetchMock = mockFetch({ id: 7 });

    await expect(createRegulering(request)).resolves.toBe(7);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/regulering/api/reguleringer");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(tilReformSpec(request));
  });

  it("feiler når serveren ikke lagrer reguleringen", async () => {
    mockFetch({}, false);

    await expect(createRegulering(request)).rejects.toThrow("kunne ikke lagres");
  });

  it("lister sammendragene fra serveren", async () => {
    const sammendrag = [{ id: 1, navn: "Test", ikrafttredelse: "2026-10-21" }];
    mockFetch(sammendrag);

    await expect(listReguleringer()).resolves.toEqual(sammendrag);
  });

  it("gir meldingene fra serveren når reguleringen avvises", async () => {
    mockFetch(
      {
        gyldig: false,
        feil: [{ melding: "Første feil." }, { melding: "Andre feil." }],
      },
      false,
      422,
    );

    await expect(createRegulering(request)).rejects.toThrow("Første feil. Andre feil.");
  });

  it("sender den endrede reformSpec med PUT", async () => {
    const fetchMock = mockFetch({});

    await updateRegulering(7, request);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/regulering/api/reguleringer/7");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(tilReformSpec(request));
  });

  it("update feiler når serveren ikke lagrer endringen", async () => {
    mockFetch({}, false);

    await expect(updateRegulering(7, request)).rejects.toThrow("kunne ikke lagres");
  });

  it("update feiler når reguleringen som skal endres ikke finnes", async () => {
    mockFetch({}, false, 404);
    await expect(updateRegulering(12345, request)).rejects.toThrow("Fant ikke reguleringen");
  });

  it("update feiler med norsk melding når nettverket feiler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(updateRegulering(7, request)).rejects.toThrow(
      "Reguleringen kunne ikke lagres på serveren",
    );
  });

  it("get feiler når reguleringen ikke finnes", async () => {
    mockFetch({}, false, 404);
    await expect(getRegulering(404)).rejects.toThrow("Fant ikke reguleringen");
  });

  it("get feiler med norsk melding når serveren eller nettverket feiler", async () => {
    mockFetch({}, false);
    await expect(getRegulering(3)).rejects.toThrow("kunne ikke hentes");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getRegulering(3)).rejects.toThrow("Reguleringen kunne ikke hentes fra serveren");
  });
  it("henter en regulering og mapper den fra reformSpec", async () => {
    mockFetch(tilReformSpec(request));

    await expect(getRegulering(3)).resolves.toMatchObject({
      id: 3,
      navn: request.navn,
      dato: request.dato,
    });
  });

  it("henter vegnavnene fra adresse-API-et", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: URL | string) => {
        const sok = new URL(url).searchParams;
        if (!sok.has("adressekode")) return Promise.resolve(Response.json(tilReformSpec(request)));
        const vegnavn = new Map([
          ["1525-1234", "Storgata"],
          ["1508-5678", "Kirkevegen"],
        ]);
        const adressenavn = vegnavn.get(`${sok.get("kommunenummer")}-${sok.get("adressekode")}`);
        const adressekode = Number(sok.get("adressekode"));
        return Promise.resolve(
          Response.json({ adresser: [{ adressekode, adressenavn, nummer: 1, bokstav: "" }] }),
        );
      }),
    );

    const { grensejustering } = await getRegulering(3);

    expect(grensejustering.vegadresser[0]?.veg.adressenavn).toBe("Storgata");
    expect(grensejustering.vegadresser[0]?.nyVeg?.adressenavn).toBe("Kirkevegen");
  });

  it("viser adressekoden når vegnavnet ikke kan hentes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: URL | string) =>
        new URL(url).searchParams.has("adressekode")
          ? Promise.reject(new TypeError("Failed to fetch"))
          : Promise.resolve(Response.json(tilReformSpec(request))),
      ),
    );

    const { grensejustering } = await getRegulering(3);

    expect(grensejustering.vegadresser[0]?.veg.adressenavn).toBe("Adressekode 1234");
  });
});
