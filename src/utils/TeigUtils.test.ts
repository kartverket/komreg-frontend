import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getMatrikkelenheterConnectedToTeigAtPoint,
  type ReguleringApiResponse,
} from "@/utils/TeigUtils";

describe("TeigUtils", () => {
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
