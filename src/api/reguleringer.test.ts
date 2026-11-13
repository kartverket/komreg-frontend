import { describe, expect, it, vi } from "vite-plus/test";
import { tilReformSpec } from "@/domain/reformSpec";
import type { OpprettReguleringRequest } from "@/domain/regulering";
import { createRegulering, getRegulering, listReguleringer } from "./reguleringer";

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

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi
    .fn<(url: URL, init?: RequestInit) => Promise<Pick<Response, "ok" | "json">>>()
    .mockResolvedValue({ ok, json: () => Promise.resolve(body) });
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

  it("lager sammendrag for reguleringslisten", async () => {
    mockFetch([{ id: 1, navn: "Test", ikrafttredelse: "2026-10-21" }]);

    await expect(listReguleringer()).resolves.toEqual([
      { id: 1, navn: "Test", dato: "2026-10-21", fraKommunenummer: "", tilKommunenummer: "" },
    ]);
  });

  it("henter en regulering og mapper den fra reformSpec", async () => {
    mockFetch(tilReformSpec(request));

    await expect(getRegulering(3)).resolves.toMatchObject({
      id: 3,
      navn: request.navn,
      dato: request.dato,
    });
  });

  it("feiler når reguleringen ikke kan hentes", async () => {
    mockFetch({}, false);

    await expect(getRegulering(404)).rejects.toThrow("kunne ikke hentes");
  });
});
