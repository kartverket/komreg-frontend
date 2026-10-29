import { describe, expect, it, vi } from "vite-plus/test";
import { Feature } from "ol";
import Polygon from "ol/geom/Polygon";
import { matrikkelnummerFinnes, teigFeatureToTeigResponse } from "@/utils/TeigUtils";

describe("matrikkelnummerFinnes", () => {
  const nummer = { gardsnummer: 1, bruksnummer: 2 };

  it("slår opp gårds- og bruksnummer direkte i eiendoms-API-et", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [{}] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(matrikkelnummerFinnes("0302", nummer)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/geokoding?kommunenummer=0302&gardsnummer=1&bruksnummer=2"),
    );
  });

  it("svarer nei når eiendoms-API-et ikke finner nummeret", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ features: [] }) }),
    );

    await expect(matrikkelnummerFinnes("0302", nummer)).resolves.toBe(false);
  });

  it("feiler når eiendoms-API-et svarer med feil", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(matrikkelnummerFinnes("0302", nummer)).rejects.toThrow("500");
  });

  it("slår opp et helt gårdsnummer i Teig-WFS-en og ber om ett treff", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"></wfs:FeatureCollection>',
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    const helGard = { gardsnummer: 1, bruksnummer: null };
    await expect(matrikkelnummerFinnes("0302", helGard)).resolves.toBe(false);
    const body = String((fetchMock.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).toContain('count="1"');
    expect(body).toContain("app:gardsnummer");
  });
});

describe("TeigUtils", () => {
  describe("teigFeatureToTeigResponse", () => {
    it("should convert a Teig feature to a Teig response correctly", () => {
      const coordinates = [
        [
          [10, 60],
          [10, 61],
          [11, 61],
          [10, 60],
        ],
      ];
      const feature = new Feature({
        geometry: new Polygon(coordinates),
        identTeig: {
          IdentTeig: {
            teigId: "100000001",
            navnerom: "https://data.geonorge.no/sosi/matrikkel/eiendomskart_teig",
            versjonId: "1",
          },
        },
        datafangstdato: "2000-01-01T00:00:00",
        oppdateringsdato: "2024-01-01T00:00:00",
        kommunenummer: "0000",
        kommunenavn: "TESTKOMMUNE",
        matrikkelenhet: {
          Matrikkelenhet: {
            kommunenummer: "0000",
            gardsnummer: "1",
            bruksnummer: "1",
            bruksnavn: "TESTGÅRDEN",
            matrikkelenhetstype: "Grunneiendom",
            punktfeste: "false",
            avklartEiere: "false",
            avklartAndeler: "false",
            harAvtaleGrensePunktfeste: "false",
            harAvtaleStedbundenRettighet: "false",
            harGrunnforurensing: "false",
            harKulturminne: "false",
            harRegistrertGrunnerverv: "false",
            harRegistrertJordskifteKrevd: "false",
            matrikkelenhetId: "100000002",
            uuidMatrikkelenhet: "a198fc62-7142-4f43-a41c-3826b791e043",
          },
        },
        matrikkelnummerTekst: "1/1",
        teigMedFlereMatrikkelenheter: "false",
        tvist: "false",
        uregistrertJordsameie: "false",
        avklartEiere: "false",
        teigareal: {
          Areal: {
            lagretBeregnetAreal: "1000.0",
          },
        },
        noyaktighetsklasseTeig: "Gult",
        uuidTeig: "f653c2e4-c8a4-48e6-a13e-2ddb962d4e4a",
      });
      feature.setId("teig.100000000");

      const result = teigFeatureToTeigResponse(feature);

      expect(result).toEqual({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates,
        },
        properties: {
          bruksnummer: 1,
          festenummer: 0,
          gardsnummer: 1,
          hovedområde: true,
          kommunenummer: "0000",
          lokalid: 100000000,
          matrikkelnummertekst: "1/1",
          meterFraPunkt: 0,
          nøyaktighetsklasseteig: "Gult",
          objekttype: "Teig",
          oppdateringsdato: "2024-01-01T00:00:00",
          seksjonsnummer: null,
          teigmedflerematrikkelenheter: false,
          uregistrertjordsameie: false,
        },
      });
    });

    it("should return undefined when the geometry is not a Polygon", () => {
      const feature = new Feature({ geometry: undefined });
      feature.setId("teig.123");

      expect(teigFeatureToTeigResponse(feature)).toBeUndefined();
    });

    it("should return undefined when the feature id does not contain a parsable lokalid", () => {
      const feature = new Feature({
        geometry: new Polygon([
          [
            [10, 60],
            [10, 61],
            [11, 61],
            [10, 60],
          ],
        ]),
      });
      feature.setId("teig.not-a-number");

      expect(teigFeatureToTeigResponse(feature)).toBeUndefined();
    });
  });
});
