import { beforeEach, describe, expect, it } from "vite-plus/test";
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

describe("midlertidig reguleringslager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("oppretter og henter en regulering", async () => {
    const id = await createRegulering(request);

    await expect(getRegulering(id)).resolves.toEqual({ id, ...request });
  });

  it("gir fortløpende ID-er", async () => {
    await createRegulering(request);

    await expect(createRegulering(request)).resolves.toBe(2);
  });

  it("lager sammendrag for reguleringslisten", async () => {
    await createRegulering(request);

    await expect(listReguleringer()).resolves.toEqual([
      {
        id: 1,
        navn: request.navn,
        dato: request.dato,
        fraKommunenummer: "1525",
        tilKommunenummer: "1508",
      },
    ]);
  });

  it("feiler tydelig når reguleringen ikke finnes", async () => {
    await expect(getRegulering(404)).rejects.toThrow("Fant ikke reguleringen");
  });
});
