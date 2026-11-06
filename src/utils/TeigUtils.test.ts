import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getMatrikkelenheterConnectedToTeigAtPoint,
  type ReguleringApiResponse,
} from "@/utils/TeigUtils";
import { matrikkelnummerFinnes } from "@/utils/TeigUtils";

type FetchMock = (input: string, init?: RequestInit) => Promise<Partial<Response>>;

describe("TeigUtils", () => {
  describe("matrikkelnummerFinnes", () => {
    const nummer = { gardsnummer: 1, bruksnummer: 2 };

    it("slår opp gårds- og bruksnummer direkte i eiendoms-API-et", async () => {
      const fetchMock = vi.fn<FetchMock>().mockResolvedValue({
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
      const fetchMock = vi.fn<FetchMock>().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"></wfs:FeatureCollection>',
          ),
      });
      vi.stubGlobal("fetch", fetchMock);

      const helGard = { gardsnummer: 1, bruksnummer: null };
      await expect(matrikkelnummerFinnes("0302", helGard)).resolves.toBe(false);
      const body = fetchMock.mock.calls[0]?.[1]?.body;
      expect(body).toEqual(expect.stringContaining('count="1"'));
      expect(body).toEqual(expect.stringContaining("app:gardsnummer"));
    });
  });
  describe("getMatrikkelenheterConnectedToTeigAtPoint", () => {
    const webmercatorCoordinate = [910000, 8670000];
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    it("sends the clicked point to the backend as UTM33 easting/northing", async () => {
      const [expectedEasting, expectedNorthing] = [133540.29463627184, 6803311.703038221];
      const mockResponse: ReguleringApiResponse = {
        crs: {
          type: "name",
          properties: {
            name: "urn:ogc:def:crs:EPSG::25833",
          },
        },
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [89000, 6900000],
            },
            properties: {
              municipalityNumber: "1525",
              addressCode: 1093,
              addressName: "Adressesen",
              addressNumber: 1,
              addressNumberExtension: null,
            },
            id: 1,
            featureType: "Address",
          },
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[[89104.5496155555, 6934257.132968337]]],
            },
            properties: {
              cadastralNumbers: [
                {
                  municipalityNumber: "1525",
                  landNumber: 2222,
                  titleNumber: 2222,
                },
              ],
              coveringParcel: false,
            },
            id: 22,
            featureType: "Parcel",
          },
        ],
        type: "FeatureCollection",
      };

      const mockedFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(mockResponse));
      vi.stubGlobal("fetch", mockedFetch);

      await getMatrikkelenheterConnectedToTeigAtPoint(webmercatorCoordinate);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      const url = mockedFetch.mock.calls[0]?.[0] as URL;
      expect(Number(url.searchParams.get("easting"))).toBeCloseTo(expectedEasting, 2);
      expect(Number(url.searchParams.get("northing"))).toBeCloseTo(expectedNorthing, 2);
    });
    it("gives each teig without matrikkelnummer (gnr 0) its own matrikkelenhet", async () => {
      const parcel = (
        id: number,
        titleNumber: number,
      ): ReguleringApiResponse["features"][number] => ({
        type: "Feature",
        id,
        featureType: "Parcel",
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
        properties: {
          cadastralNumbers: [{ municipalityNumber: "1525", landNumber: 0, titleNumber }],
          coveringParcel: false,
        },
      });
      const mockResponse: ReguleringApiResponse = {
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::32633" } },
        features: [parcel(1, 0), parcel(2, 0), parcel(3, 1)],
      };
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(mockResponse)));

      const enheter = await getMatrikkelenheterConnectedToTeigAtPoint(webmercatorCoordinate);

      expect(enheter.map((enhet) => enhet.id)).toEqual(["teig/1", "teig/2", "teig/3"]);
      expect(enheter[2]?.matrikkelnummer).toEqual({
        kommunenummer: "1525",
        gardsnummer: 0,
        bruksnummer: 1,
      });
    });
    it("Throws if the fetch returns !Ok", async () => {
      const notOkResponse = new Response(null, { status: 500 });

      const mockedFetch = vi.fn<typeof fetch>().mockResolvedValue(notOkResponse);
      vi.stubGlobal("fetch", mockedFetch);

      await expect(
        getMatrikkelenheterConnectedToTeigAtPoint(webmercatorCoordinate),
      ).rejects.toThrow(/500/);
    });
  });
});
