import { describe, expect, it } from "vite-plus/test";
import { tilReformSpec } from "./reformSpec";
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
  return tilReformSpec({ navn: "Test", dato: "2027-01-01", grensejustering }).operasjoner;
}

describe("tilReformSpec", () => {
  it("flytter bokstavene på et husnummer som én operasjon", () => {
    expect(spec([adresse("A"), adresse("B"), adresse("C")])).toEqual([
      {
        op: "move",
        kind: "addressNumber",
        key: ["03", "01", 1234, 8],
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
      { op: "move", kind: "addressCode", key: ["03", "01", 1234], to: ["03", "02", 1234] },
    ]);
  });
});
