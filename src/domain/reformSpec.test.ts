import { describe, expect, it } from "vite-plus/test";
import type { AdjustOp, ReformSpec } from "@/types/ReformSpec";
import { fraReformSpec, tilReformSpec } from "./reformSpec";
import type { GrensejusteringDraft } from "./regulering";
import type { VegadresseDraft } from "./vegadresse";

const veg = { adressekode: 1234, adressenavn: "Langemyrvegen" };
const nyVeg = { adressekode: 5678, adressenavn: "Langemyrvegen" };

function adresse(bokstav: string, resten: Partial<VegadresseDraft> = {}): VegadresseDraft {
  return { kommunenummer: "0301", veg, husnummer: { nummer: 8, bokstav }, nyVeg, ...resten };
}

function spec(vegadresser: VegadresseDraft[]) {
  const grensejustering: GrensejusteringDraft = {
    fraKommunenummer: "0301",
    tilKommunenummer: "0302",
    matrikkelenheter: [],
    teiger: [],
    vegadresser,
  };
  const [adjust] = tilReformSpec({
    navn: "Test",
    dato: "2027-01-01",
    grensejusteringer: [grensejustering],
  }).operasjoner as AdjustOp[];
  return adjust?.then;
}

const grensejusteringer: GrensejusteringDraft[] = [
  {
    fraKommunenummer: "0301",
    tilKommunenummer: "0302",
    matrikkelenheter: [
      { kommunenummer: "0301", gardsnummer: 1, bruksnummer: 2, teigIder: [], nyGardsnummer: 5 },
      { kommunenummer: "0301", gardsnummer: 3, bruksnummer: null, teigIder: [] },
    ],
    teiger: [{ kommunenummer: "0301", teigId: 99 }],
    vegadresser: [],
  },
  {
    fraKommunenummer: "1525",
    tilKommunenummer: "1508",
    matrikkelenheter: [{ kommunenummer: "1525", gardsnummer: 7, bruksnummer: 1, teigIder: [] }],
    teiger: [],
    vegadresser: [],
  },
];

describe("tilReformSpec", () => {
  it("gjør hver grensejustering til en adjust av fra kommune med relative pivoter", () => {
    const { operasjoner } = tilReformSpec({ navn: "Test", dato: "2027-01-01", grensejusteringer });

    expect(operasjoner).toEqual([
      {
        op: "adjust",
        kind: "municipality",
        key: ["03", "01"],
        // eslint-disable-next-line unicorn/no-thenable -- `then` er feltnavnet i reform-formatet.
        then: [
          { op: "move", kind: "titleNumber", key: [1, 2], to: ["03", "02", 5, 2] },
          { op: "move", kind: "landNumber", key: 3, to: ["03", "02", 3] },
          { op: "move", kind: "parcel", key: 99, to: ["03", "02", 99] },
        ],
      },
      {
        op: "adjust",
        kind: "municipality",
        key: ["15", "25"],
        // eslint-disable-next-line unicorn/no-thenable -- `then` er feltnavnet i reform-formatet.
        then: [{ op: "move", kind: "titleNumber", key: [7, 1], to: ["15", "08", 7, 1] }],
      },
    ]);
  });

  it("flytter bokstavene på et husnummer som én operasjon", () => {
    expect(spec([adresse("A"), adresse("B"), adresse("C")])).toEqual([
      {
        op: "move",
        kind: "addressNumber",
        key: [1234, 8],
        to: ["03", "02", 5678, 8],
      },
    ]);
  });

  it("kaster når bokstavene på samme husnummer får ulikt mål", () => {
    const annenVeg = { adressekode: 9999, adressenavn: "Annenvegen" };
    expect(() => spec([adresse("A"), adresse("B", { nyVeg: annenVeg })])).toThrow("samlet");
  });

  it("flytter hele vegen én gang", () => {
    const hel = { heleVegen: true };
    expect(spec([adresse("A", hel), adresse("B", hel)])).toEqual([
      { op: "move", kind: "addressCode", key: 1234, to: ["03", "02", 1234] },
    ]);
  });
});

describe("fraReformSpec", () => {
  it("leser hver adjust tilbake som en egen grensejustering", () => {
    const reformSpec = tilReformSpec({ navn: "Test", dato: "2027-01-01", grensejusteringer });

    expect(fraReformSpec(4, reformSpec)).toEqual({
      id: 4,
      navn: "Test",
      dato: "2027-01-01",
      grensejusteringer,
    });
  });

  it("kaster på flyttinger som ikke ligger under en adjust av en kommune", () => {
    const reformSpec: ReformSpec = {
      navn: "Test",
      ikrafttredelse: "2027-01-01",
      operasjoner: [{ op: "move", kind: "parcel", key: ["03", "01", 99], to: ["03", "02", 99] }],
    };

    expect(() => fraReformSpec(4, reformSpec)).toThrow("Ikke implementert");
  });

  it("kaster når en adjust flytter til flere kommuner", () => {
    const reformSpec: ReformSpec = {
      navn: "Test",
      ikrafttredelse: "2027-01-01",
      operasjoner: [
        {
          op: "adjust",
          kind: "municipality",
          key: ["03", "01"],
          // eslint-disable-next-line unicorn/no-thenable -- `then` er feltnavnet i reform-formatet.
          then: [
            { op: "move", kind: "parcel", key: 1, to: ["03", "02", 1] },
            { op: "move", kind: "parcel", key: 2, to: ["03", "03", 2] },
          ],
        },
      ],
    };

    expect(() => fraReformSpec(4, reformSpec)).toThrow("én kommune");
  });
});
