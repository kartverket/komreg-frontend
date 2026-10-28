import { describe, expect, it } from "vite-plus/test";
import { formatMatrikkelnummer, type MatrikkelenhetDraft } from "./regulering";

const enhet: MatrikkelenhetDraft = {
  kommunenummer: "0301",
  gardsnummer: 1,
  bruksnummer: 2,
  teigIder: [1],
};

describe("formatMatrikkelnummer", () => {
  it("viser kommune, gårdsnummer og bruksnummer", () => {
    expect(formatMatrikkelnummer(enhet)).toBe("0301-1/2");
  });
});
