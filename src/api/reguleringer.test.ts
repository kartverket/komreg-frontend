import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { OpprettReguleringRequest } from "@/domain/regulering";
import { stubReguleringBackend } from "./fakeReguleringBackend";
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
  },
};

describe("reguleringer fra backend", () => {
  let backend: ReturnType<typeof stubReguleringBackend>;

  beforeEach(() => {
    backend = stubReguleringBackend();
  });

  it("oppretter og henter en regulering", async () => {
    const id = await createRegulering(request);

    await expect(getRegulering(id)).resolves.toEqual({ id, ...request });
  });

  it("har den opprettede reguleringen med en gang, uten å vente på strømmen", async () => {
    await listReguleringer();
    backend.upsertsUteblir = true;

    const id = await createRegulering(request);

    await expect(getRegulering(id)).resolves.toEqual({ id, ...request });
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

  it("får med reguleringer som andre oppretter mens strømmen er åpen", async () => {
    await expect(listReguleringer()).resolves.toEqual([]);

    const fraAndre = backend.opprett({ ...request, navn: "Fra en annen bruker" });

    await expect(getRegulering(fraAndre.id)).resolves.toEqual(fraAndre);
  });

  it("feiler tydelig når reguleringen ikke finnes", async () => {
    await expect(getRegulering(404)).rejects.toThrow("Fant ikke reguleringen");
  });

  it("feiler når lagringen feiler", async () => {
    backend.lagringFeiler = true;

    await expect(createRegulering(request)).rejects.toThrow("Reguleringen kunne ikke lagres");
  });

  it("feiler når strømmen ikke kommer opp, og prøver på nytt ved neste kall", async () => {
    backend.strommenFeiler = true;
    await expect(listReguleringer()).rejects.toThrow("Kunne ikke hente reguleringer");

    backend.strommenFeiler = false;
    await expect(listReguleringer()).resolves.toEqual([]);
  });
});
