import { describe, expect, it } from "vite-plus/test";
import {
  formatMatrikkelnummer,
  lagMatrikkelenhetDraft,
  medHeleGardsnummer,
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
});
