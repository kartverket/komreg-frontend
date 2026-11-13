import { describe, expect, it } from "vite-plus/test";
import {
  finnKollisjoner,
  finnOpptattVegadresse,
  finnVegMedSammeNavn,
  formatNyVegadresse,
  formatVegadresse,
  grupperPaVeg,
  lagVegadresseDrafts,
  medNyeVegadresser,
  nyeAdressekoder,
  validerVegadresser,
  type VegadresseDraft,
} from "./vegadresse";

const storgata = { adressekode: 1234, adressenavn: "Storgata" };
const kirkevegen = { adressekode: 5678, adressenavn: "Kirkevegen" };

const vegadresse: VegadresseDraft = {
  kommunenummer: "0301",
  veg: storgata,
  husnummer: { nummer: 5, bokstav: "" },
};

const flyttet: VegadresseDraft = { ...vegadresse, nyVeg: kirkevegen };

describe("lagVegadresseDrafts", () => {
  const adresse = { kommunenummer: "0301", adressekode: 1234, nummer: 5, adressenavn: "Storgata" };

  it("gir én vegadresse per adresse, med bokstav", () => {
    expect(lagVegadresseDrafts([adresse, { ...adresse, bokstav: "A" }])).toEqual([
      vegadresse,
      { ...vegadresse, husnummer: { nummer: 5, bokstav: "A" } },
    ]);
  });

  it("hopper over adresser uten adressekode eller nummer", () => {
    const adresser = [
      { ...adresse, adressekode: undefined },
      { ...adresse, nummer: undefined },
    ];
    expect(lagVegadresseDrafts(adresser)).toEqual([]);
  });
});

describe("formatVegadresse og formatNyVegadresse", () => {
  it("viser dagens og ny adresse", () => {
    expect(formatVegadresse({ ...vegadresse, husnummer: { nummer: 5, bokstav: "A" } })).toBe(
      "Storgata 5A",
    );
    expect(formatNyVegadresse(vegadresse)).toBe("Ikke valgt");
    expect(formatNyVegadresse(flyttet)).toBe("Kirkevegen 5");
    expect(formatNyVegadresse({ ...flyttet, nyttHusnummer: { nummer: 7, bokstav: "B" } })).toBe(
      "Kirkevegen 7B",
    );
  });
});

describe("medNyeVegadresser", () => {
  const veger = new Map([["0301-1234", kirkevegen]]);
  const ingenValg = {
    heleVeger: new Set<string>(),
    veger: new Map(),
    egneVeger: new Map(),
    husnumre: new Map(),
  };

  it("gir alle adressene på vegen den valgte vegen, og tolker husnummer med bokstav", () => {
    const annen = { ...vegadresse, husnummer: { nummer: 7, bokstav: "" } };
    const husnumre = new Map([["0301-1234-5", " 12b "]]);
    expect(medNyeVegadresser([vegadresse, annen], { ...ingenValg, veger, husnumre })).toEqual([
      { ...flyttet, nyttHusnummer: { nummer: 12, bokstav: "B" } },
      { ...annen, nyVeg: kirkevegen },
    ]);
  });

  it("lar en adresse få en annen veg enn resten", () => {
    const annen = { ...vegadresse, husnummer: { nummer: 7, bokstav: "" } };
    const egneVeger = new Map([["0301-1234-7", storgata]]);
    expect(medNyeVegadresser([vegadresse, annen], { ...ingenValg, veger, egneVeger })).toEqual([
      flyttet,
      { ...annen, nyVeg: storgata },
    ]);
  });

  it("gir ingen veg når adressen skal ha egen veg som ikke er valgt ennå", () => {
    const egneVeger = new Map([["0301-1234-5", null]]);
    expect(medNyeVegadresser([vegadresse], { ...ingenValg, veger, egneVeger })).toEqual([
      vegadresse,
    ]);
  });

  it("lar hele vegen flyttes med samme adressekode, uten å velge veg i til kommune", () => {
    const heleVeger = new Set(["0301-1234"]);
    expect(medNyeVegadresser([vegadresse], { ...ingenValg, heleVeger })).toEqual([
      { ...vegadresse, heleVegen: true, nyVeg: vegadresse.veg },
    ]);
  });

  it("beholder dagens husnummer når feltet er tomt", () => {
    const husnumre = new Map([["0301-1234-5", ""]]);
    expect(medNyeVegadresser([vegadresse], { ...ingenValg, veger, husnumre })).toEqual([flyttet]);
  });

  it("gjør tekst som ikke er et husnummer om til NaN", () => {
    const husnumre = new Map([["0301-1234-5", "tolv"]]);
    const [adresse] = medNyeVegadresser([vegadresse], { ...ingenValg, husnumre });
    expect(adresse?.nyttHusnummer?.nummer).toBeNaN();
  });
});

describe("grupperPaVeg", () => {
  it("samler adressene per veg i fra kommune", () => {
    const annen = { ...vegadresse, husnummer: { nummer: 7, bokstav: "" } };
    const paKirkevegen = { ...vegadresse, veg: kirkevegen };
    expect(grupperPaVeg([vegadresse, paKirkevegen, annen])).toEqual([
      { nokkel: "0301-1234", veg: storgata, adresser: [vegadresse, annen] },
      { nokkel: "0301-5678", veg: kirkevegen, adresser: [paKirkevegen] },
    ]);
  });
});

describe("finnVegMedSammeNavn", () => {
  it("finner vegen med samme navn, uansett store og små bokstaver", () => {
    const storgataITilKommune = { adressekode: 9999, adressenavn: "STORGATA" };
    const kandidater = [{ adressekode: 9998, adressenavn: "Storgata øst" }, storgataITilKommune];
    expect(finnVegMedSammeNavn(storgata, kandidater)).toBe(storgataITilKommune);
  });

  it("gir undefined når ingen veg har samme navn", () => {
    expect(finnVegMedSammeNavn(storgata, [kirkevegen])).toBeUndefined();
  });
});

describe("finnKollisjoner", () => {
  const eksisterende = [{ adressekode: 5678, husnummer: { nummer: 5, bokstav: "" } }];

  it("markerer adresser som havner på en adresse som finnes", () => {
    expect(finnKollisjoner([flyttet], eksisterende)).toEqual(new Set(["0301-1234-5"]));
  });

  it("markerer begge adressene når to havner på samme adresse", () => {
    const annen = { ...flyttet, husnummer: { nummer: 7, bokstav: "" } };
    const kollisjon = { ...annen, nyttHusnummer: { nummer: 5, bokstav: "" } };
    expect(finnKollisjoner([flyttet, kollisjon], [])).toEqual(
      new Set(["0301-1234-5", "0301-1234-7"]),
    );
  });

  it("ser bort fra adresser uten valgt veg", () => {
    expect(finnKollisjoner([vegadresse, vegadresse], eksisterende)).toEqual(new Set());
  });
});

describe("nyeAdressekoder", () => {
  it("gir hver valgt veg én gang", () => {
    expect(nyeAdressekoder([vegadresse, flyttet, flyttet])).toEqual([5678]);
  });
});

describe("validerVegadresser", () => {
  it("godtar adresser med valgt veg", () => {
    expect(validerVegadresser([flyttet], "0301")).toBeNull();
  });

  it("avviser adresser utenfor fra kommune", () => {
    expect(validerVegadresser([flyttet], "0303")).toMatch("fra kommune");
  });

  it("avviser adresser uten valgt veg", () => {
    expect(validerVegadresser([vegadresse], "0301")).toMatch(
      "Velg veg i til kommune for Storgata 5",
    );
  });

  it("avviser husnummer som ikke er positive heltall", () => {
    for (const nummer of [Number.NaN, 0]) {
      const ugyldig = { ...flyttet, nyttHusnummer: { nummer, bokstav: "" } };
      expect(validerVegadresser([ugyldig], "0301")).toMatch("for eksempel 12B");
    }
  });

  it("avviser to adresser som havner på samme adresse", () => {
    const annen = { ...flyttet, husnummer: { nummer: 7, bokstav: "" } };
    const kollisjon = { ...annen, nyttHusnummer: { nummer: 5, bokstav: "" } };
    expect(validerVegadresser([flyttet, kollisjon], "0301")).toMatch("Kirkevegen 5");
  });

  it("godtar samme nummer med ulik bokstav", () => {
    const annen = { ...flyttet, husnummer: { nummer: 7, bokstav: "" } };
    const medBokstav = { ...annen, nyttHusnummer: { nummer: 5, bokstav: "A" } };
    expect(validerVegadresser([flyttet, medBokstav], "0301")).toBeNull();
  });
});

describe("finnOpptattVegadresse", () => {
  const eksisterende = [{ adressekode: 5678, husnummer: { nummer: 5, bokstav: "" } }];

  it("avviser en adresse som finnes på vegen i til kommune", () => {
    expect(finnOpptattVegadresse([flyttet], "0302", eksisterende)).toMatch(
      "Storgata 5 får Kirkevegen 5, som allerede finnes i 0302",
    );
  });

  it("godtar et ledig husnummer", () => {
    const ledig = { ...flyttet, nyttHusnummer: { nummer: 5, bokstav: "B" } };
    expect(finnOpptattVegadresse([ledig], "0302", eksisterende)).toBeNull();
  });
});
