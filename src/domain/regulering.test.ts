import { describe, expect, it } from "vite-plus/test";
import {
  finnOpptattMatrikkelnummer,
  formatMatrikkelnummer,
  formatNyttMatrikkelnummer,
  lagMatrikkelenhetDraft,
  matrikkelnumreITilKommune,
  medHeleGardsnummer,
  medNyeMatrikkelnumre,
  validerGrensejustering,
  type MatrikkelenhetDraft,
} from "./regulering";

function teig(lokalid: number, bruksnummer: number | null) {
  return { properties: { lokalid, kommunenummer: "0301", gardsnummer: 1, bruksnummer } };
}

const enhet: MatrikkelenhetDraft = {
  kommunenummer: "0301",
  gardsnummer: 1,
  bruksnummer: 2,
  teigIder: [1],
};

describe("lagMatrikkelenhetDraft", () => {
  it("tar med alle teigene i matrikkelenheten", () => {
    expect(lagMatrikkelenhetDraft({ features: [teig(10, 2), teig(11, 2)] })).toEqual({
      kommunenummer: "0301",
      gardsnummer: 1,
      bruksnummer: 2,
      teigIder: [10, 11],
    });
  });

  it("gir null for teiger uten matrikkelnummer", () => {
    expect(lagMatrikkelenhetDraft({ features: [teig(10, null)] })).toBeNull();
  });
});

describe("medHeleGardsnummer", () => {
  const bnr3 = { ...enhet, bruksnummer: 3, teigIder: [2] };
  const annenGard = { ...enhet, gardsnummer: 5, teigIder: [3] };

  it("slår sammen bruksnumrene i valgte gårdsnumre", () => {
    expect(medHeleGardsnummer([enhet, bnr3, annenGard], new Set(["0301-1"]))).toEqual([
      { ...enhet, bruksnummer: null, teigIder: [1, 2] },
      annenGard,
    ]);
  });

  it("lar resten være uendret", () => {
    expect(medHeleGardsnummer([enhet, bnr3], new Set())).toEqual([enhet, bnr3]);
  });
});

describe("formatMatrikkelnummer", () => {
  it("viser gårdsnummer med og uten bruksnummer", () => {
    expect(formatMatrikkelnummer(enhet)).toBe("0301-1/2");
    expect(formatMatrikkelnummer({ ...enhet, bruksnummer: null })).toBe(
      "0301-1 (hele gårdsnummeret)",
    );
  });
});

describe("medNyeMatrikkelnumre", () => {
  const helGard = { ...enhet, bruksnummer: null };

  it("legger inn tastede numre og lar tomme felt være", () => {
    const nyeNumre = new Map([["0301-1/2", { gardsnummer: " 201 ", bruksnummer: "" }]]);
    expect(medNyeMatrikkelnumre([enhet], nyeNumre)).toEqual([{ ...enhet, nyGardsnummer: 201 }]);
  });

  it("ignorerer bruksnummer når hele gårdsnummeret flyttes", () => {
    const nyeNumre = new Map([
      ["0301-1 (hele gårdsnummeret)", { gardsnummer: "201", bruksnummer: "7" }],
    ]);
    expect(medNyeMatrikkelnumre([helGard], nyeNumre)).toEqual([{ ...helGard, nyGardsnummer: 201 }]);
  });

  it("lar enheter uten tastede numre være uendret", () => {
    expect(medNyeMatrikkelnumre([enhet], new Map())).toEqual([enhet]);
  });
});

describe("formatNyttMatrikkelnummer", () => {
  it("viser nytt nummer, eller at det er uendret", () => {
    expect(formatNyttMatrikkelnummer(enhet)).toBe("Uendret");
    expect(formatNyttMatrikkelnummer({ ...enhet, nyBruksnummer: 5 })).toBe("1/5");
    expect(formatNyttMatrikkelnummer({ ...enhet, bruksnummer: null, nyGardsnummer: 201 })).toBe(
      "201",
    );
  });
});

describe("validerGrensejustering", () => {
  const gyldig = { fraKommunenummer: "0301", tilKommunenummer: "0302", matrikkelenheter: [enhet] };

  it("godtar en gyldig grensejustering", () => {
    expect(validerGrensejustering(gyldig)).toBeNull();
  });

  it("avviser kommunenummer som ikke er fire siffer", () => {
    expect(validerGrensejustering({ ...gyldig, tilKommunenummer: "302" })).toMatch("firesifret");
  });

  it("avviser lik fra- og tilkommune", () => {
    expect(validerGrensejustering({ ...gyldig, tilKommunenummer: "0301" })).toMatch("forskjellige");
  });

  it("avviser matrikkelenheter utenfor fra kommune", () => {
    expect(validerGrensejustering({ ...gyldig, fraKommunenummer: "0303" })).toMatch("fra kommune");
  });

  it("avviser nye numre som ikke er positive heltall", () => {
    const ugyldige = [{ nyGardsnummer: Number.NaN }, { nyBruksnummer: 0 }, { nyGardsnummer: 1.5 }];
    for (const nytt of ugyldige) {
      const matrikkelenheter = [{ ...enhet, ...nytt }];
      expect(validerGrensejustering({ ...gyldig, matrikkelenheter })).toMatch("positive heltall");
    }
  });

  it("godtar nye numre som er positive heltall", () => {
    const flyttet = { ...enhet, nyGardsnummer: 201, nyBruksnummer: 5 };
    expect(validerGrensejustering({ ...gyldig, matrikkelenheter: [flyttet] })).toBeNull();
  });

  it("avviser to enheter som får samme matrikkelnummer", () => {
    const bnr3 = { ...enhet, bruksnummer: 3, nyBruksnummer: 2 };
    expect(validerGrensejustering({ ...gyldig, matrikkelenheter: [enhet, bnr3] })).toMatch("1/2");
  });

  it("avviser et helt gårdsnummer som havner på et gårdsnummer som er i bruk", () => {
    const helGard = { ...enhet, gardsnummer: 5, bruksnummer: null, nyGardsnummer: 1 };
    expect(validerGrensejustering({ ...gyldig, matrikkelenheter: [enhet, helGard] })).toMatch(
      "matrikkelnummer 1 ",
    );
  });

  it("godtar enheter i reguleringen som får ulike numre", () => {
    const flyttet = { ...enhet, nyGardsnummer: 201 };
    expect(validerGrensejustering({ ...gyldig, matrikkelenheter: [enhet, flyttet] })).toBeNull();
  });
});

describe("matrikkelnumreITilKommune", () => {
  it("gir hvert nummer enhetene havner på, én gang", () => {
    const flyttet = { ...enhet, bruksnummer: 3, nyGardsnummer: 201 };
    const helGard = { ...enhet, gardsnummer: 5, bruksnummer: null };
    expect(matrikkelnumreITilKommune([enhet, { ...enhet }, flyttet, helGard])).toEqual([
      { gardsnummer: 1, bruksnummer: 2 },
      { gardsnummer: 201, bruksnummer: 3 },
      { gardsnummer: 5, bruksnummer: null },
    ]);
  });
});

describe("finnOpptattMatrikkelnummer", () => {
  const eksisterende = [
    { gardsnummer: 1, bruksnummer: 2 },
    { gardsnummer: 1, bruksnummer: null },
  ];

  it("avviser et matrikkelnummer som finnes i til kommune", () => {
    expect(finnOpptattMatrikkelnummer([enhet], "0302", eksisterende)).toMatch(
      "0301-1/2 får 1/2, som allerede finnes i 0302",
    );
  });

  it("godtar et nytt bruksnummer som er ledig", () => {
    const ledig = { ...enhet, nyBruksnummer: 3 };
    expect(finnOpptattMatrikkelnummer([ledig], "0302", eksisterende)).toBeNull();
  });

  it("avviser et helt gårdsnummer når gårdsnummeret er i bruk i til kommune", () => {
    const helGard = { ...enhet, bruksnummer: null };
    expect(finnOpptattMatrikkelnummer([helGard], "0302", eksisterende)).toMatch("får 1,");
  });

  it("godtar et helt gårdsnummer flyttet til et ledig gårdsnummer", () => {
    const helGard = { ...enhet, bruksnummer: null, nyGardsnummer: 7 };
    expect(finnOpptattMatrikkelnummer([helGard], "0302", eksisterende)).toBeNull();
  });
});
