import { describe, expect, it } from "vite-plus/test";
import {
  formatMatrikkelnummer,
  lagMatrikkelenheterFraTeiger,
  validerGrensejustering,
  type MatrikkelenhetDraft,
  type TeigForRegulering,
} from "./regulering";

function teig(lokalid: number, bruksnummer: number): TeigForRegulering {
  return {
    properties: {
      lokalid,
      kommunenummer: "1525",
      gardsnummer: 12,
      bruksnummer,
      festenummer: 0,
      seksjonsnummer: 0,
    },
  };
}

describe("lagMatrikkelenheterFraTeiger", () => {
  it("samler flere teiger for samme matrikkelenhet", () => {
    const result = lagMatrikkelenheterFraTeiger([teig(10, 4), teig(11, 4), teig(12, 5)]);

    expect(result).toMatchObject([{ teigIder: [10, 11] }, { teigIder: [12] }]);
  });

  it("tar ikke med samme teig flere ganger", () => {
    const result = lagMatrikkelenheterFraTeiger([teig(10, 4), teig(10, 4)]);

    expect(result).toMatchObject([{ teigIder: [10] }]);
  });

  it("bruker 0 når seksjonsnummer mangler", () => {
    const utenSeksjon = teig(10, 4);
    utenSeksjon.properties.seksjonsnummer = null;

    const result = lagMatrikkelenheterFraTeiger([utenSeksjon, teig(11, 4)]);

    expect(result).toMatchObject([{ seksjonsnummer: 0, teigIder: [10, 11] }]);
  });
});

const enhet: MatrikkelenhetDraft = {
  kommunenummer: "0301",
  gardsnummer: 1,
  bruksnummer: 2,
  festenummer: 0,
  seksjonsnummer: 0,
  teigIder: [1],
};

describe("formatMatrikkelnummer", () => {
  it("utelater feste- og seksjonsnummer som er 0 på slutten", () => {
    expect(formatMatrikkelnummer(enhet)).toBe("0301-1/2");
    expect(formatMatrikkelnummer({ ...enhet, festenummer: 3 })).toBe("0301-1/2/3");
    expect(formatMatrikkelnummer({ ...enhet, seksjonsnummer: 4 })).toBe("0301-1/2/0/4");
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
