import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getGrunnkretsAtPoint,
  getMatrikkelenheterConnectedToTeigAtPoint,
  getMatrikkelenheterInGrunnkrets,
  type ReguleringApiGrunnkrets,
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
  describe("getGrunnkretsAtPoint", () => {
    const webmercatorCoordinate = [910000, 8670000];
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("asks the backend for the krets at the point as UTM33 easting/northing", async () => {
      const krets: ReguleringApiGrunnkrets = {
        type: "Feature",
        id: 7,
        featureType: "Krets",
        geometry: { type: "MultiPolygon", coordinates: [[[[0, 0]]]] },
        properties: { municipalityNumber: "1525", kretsnummer: 101, kretsnavn: "Liabygda" },
      };
      const mockedFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(krets));
      vi.stubGlobal("fetch", mockedFetch);

      await expect(getGrunnkretsAtPoint(webmercatorCoordinate)).resolves.toEqual(krets);

      const url = mockedFetch.mock.calls[0]?.[0] as URL;
      expect(url.pathname).toBe("/api/regulering/point/krets");
      expect(Number(url.searchParams.get("easting"))).toBeCloseTo(133540.29, 1);
      expect(Number(url.searchParams.get("northing"))).toBeCloseTo(6803311.7, 1);
    });

    it("gives undefined when no grunnkrets covers the point", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })),
      );

      await expect(getGrunnkretsAtPoint(webmercatorCoordinate)).resolves.toBeUndefined();
    });

    it("throws on other errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
      );

      await expect(getGrunnkretsAtPoint(webmercatorCoordinate)).rejects.toThrow(/503/);
    });
  });
  describe("getMatrikkelenheterInGrunnkrets", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    const parcel = (
      id: number,
      titleNumbers: number[],
      inKrets: boolean,
    ): ReguleringApiResponse["features"][number] => ({
      type: "Feature",
      id,
      featureType: "Parcel",
      geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
      properties: {
        cadastralNumbers: titleNumbers.map((titleNumber) => ({
          municipalityNumber: "1525",
          landNumber: 10,
          titleNumber,
        })),
        inKrets,
      },
    });

    function stubKretsResponse(features: ReguleringApiResponse["features"]) {
      const response: ReguleringApiResponse = {
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::25833" } },
        features,
      };
      const mockedFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
      vi.stubGlobal("fetch", mockedFetch);
      return mockedFetch;
    }

    it("connects only the matrikkelenheter that share a teig", async () => {
      // Teig 1 deles av bnr 1 og 2, teig 2 av bnr 2 og 3. Bnr 4 står alene.
      const mockedFetch = stubKretsResponse([
        parcel(1, [1, 2], true),
        parcel(2, [2, 3], true),
        parcel(3, [4], true),
      ]);

      const enheter = await getMatrikkelenheterInGrunnkrets(7);

      const url = mockedFetch.mock.calls[0]?.[0] as URL;
      expect(url.pathname).toBe("/api/regulering/krets/7/cadastral_unit");
      const connected = Object.fromEntries(
        enheter.map((enhet) => [enhet.id, enhet.connectedToOtherUnits?.toSorted()]),
      );
      expect(connected).toEqual({
        "1525/10/1": ["1525/10/2", "1525/10/3"],
        "1525/10/2": ["1525/10/1", "1525/10/3"],
        "1525/10/3": ["1525/10/1", "1525/10/2"],
        "1525/10/4": [],
      });
    });

    it("keeps whether each teig lies in the krets", async () => {
      stubKretsResponse([parcel(1, [1], true), parcel(2, [1], false)]);

      const [enhet] = await getMatrikkelenheterInGrunnkrets(7);

      expect(enhet?.features.map((teig) => teig.properties.inKrets)).toEqual([true, false]);
    });

    it("throws if the fetch returns !Ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 })),
      );

      await expect(getMatrikkelenheterInGrunnkrets(7)).rejects.toThrow(/500/);
    });
  });
});
