import type {
  AdjustOp,
  Kind,
  KeySpec,
  MoveOp,
  OpSpec,
  PathSpec,
  ReformSpec,
  Segment,
} from "@/types/ReformSpec";
import {
  nyttMatrikkelnummer,
  type GrensejusteringDraft,
  type OpprettReguleringRequest,
  type ReguleringDetail,
} from "./regulering";
import type { Veg } from "./vegadresse";

// Kommunenummeret er fylke (2 siffer) og løpenummer (2 siffer) sammen.
function kommuneNokkel(kommunenummer: string): [string, string] {
  return [kommunenummer.slice(0, 2), kommunenummer.slice(2)];
}

function segmenter(key: PathSpec): Segment[] {
  return Array.isArray(key) ? key : [key];
}

// En grensejustering er én `adjust` av fra kommune. Kommunen står i ro, og flyttingene under den
// har pivoter relativt til kommunen. Målene (`to`) er alltid fulle nøkler fra roten.
// Bokstaven på et husnummer kan ikke uttrykkes i formatet, siden `addressNumber` bare er et tall.
// Adresser med samme nummer og ulik bokstav flyttes derfor samlet.
function tilAdjust(grensejustering: GrensejusteringDraft): AdjustOp {
  const til = kommuneNokkel(grensejustering.tilKommunenummer);
  const then: MoveOp[] = [];

  for (const enhet of grensejustering.matrikkelenheter) {
    const nytt = nyttMatrikkelnummer(enhet);
    const hel = enhet.bruksnummer === null || nytt.bruksnummer === null;
    then.push(
      hel
        ? {
            op: "move",
            kind: "landNumber",
            key: enhet.gardsnummer,
            to: [...til, nytt.gardsnummer],
          }
        : {
            op: "move",
            kind: "titleNumber",
            key: [enhet.gardsnummer, enhet.bruksnummer!],
            to: [...til, nytt.gardsnummer, nytt.bruksnummer!],
          },
    );
  }

  for (const teig of grensejustering.teiger) {
    then.push({ op: "move", kind: "parcel", key: teig.teigId, to: [...til, teig.teigId] });
  }

  const flyttedeVeger = new Set<number>();
  const flyttedeHusnumre = new Map<string, string>();
  for (const { veg, husnummer, nyVeg, nyttHusnummer, heleVegen } of grensejustering.vegadresser) {
    if (heleVegen) {
      // Hver adresse på vegen gir en egen draft, men vegen skal bare flyttes én gang.
      if (flyttedeVeger.has(veg.adressekode)) continue;
      flyttedeVeger.add(veg.adressekode);
      then.push({
        op: "move",
        kind: "addressCode",
        key: veg.adressekode,
        to: [...til, veg.adressekode],
      });
      continue;
    }
    const key = [veg.adressekode, husnummer.nummer];
    const to = [...til, (nyVeg ?? veg).adressekode, (nyttHusnummer ?? husnummer).nummer];
    // Bokstavene på et husnummer (8A, 8B, 8C) er én flytting, siden formatet bare har nummeret.
    const nokkel = key.join("-");
    const forrigeMal = flyttedeHusnumre.get(nokkel);
    if (forrigeMal === undefined) flyttedeHusnumre.set(nokkel, to.join("-"));
    else if (forrigeMal === to.join("-")) continue;
    else throw new Error("Adresser med samme husnummer må flyttes samlet, uavhengig av bokstav");
    then.push({ op: "move", kind: "addressNumber", key, to });
  }

  return {
    op: "adjust",
    kind: "municipality",
    key: kommuneNokkel(grensejustering.fraKommunenummer),
    // eslint-disable-next-line unicorn/no-thenable -- `then` er feltnavnet i reform-formatet.
    then,
  };
}

export function tilReformSpec({
  navn,
  dato,
  grensejusteringer,
}: OpprettReguleringRequest): ReformSpec {
  return { navn, ikrafttredelse: dato, operasjoner: grensejusteringer.map(tilAdjust) };
}

const STOTTEDE_KINDS: Kind[] = [
  "landNumber",
  "titleNumber",
  "parcel",
  "addressCode",
  "addressNumber",
];

function kommunenummer([fylke, kommune]: KeySpec): string {
  return `${fylke}${kommune}`;
}

// Specen har bare adressekoden, så navnet vises som koden.
function vegFraKode(adressekode: Segment | undefined): Veg {
  return { adressekode: Number(adressekode), adressenavn: `Adressekode ${adressekode}` };
}

// Støtter bare det tilAdjust lager: en `adjust` av en kommune med enkle `move` under, alle til
// samme kommune. Kaster på alt annet i stedet for å vise en ufullstendig grensejustering.
function fraAdjust(op: OpSpec): GrensejusteringDraft {
  if (op.op !== "adjust" || op.kind !== "municipality" || !Array.isArray(op.key)) {
    throw new Error(
      `Ikke implementert: støtter bare "adjust" av en kommune, ikke "${op.op}" av "${op.kind}"`,
    );
  }
  const fra = kommunenummer(op.key);
  const grensejustering: GrensejusteringDraft = {
    fraKommunenummer: fra,
    tilKommunenummer: "",
    matrikkelenheter: [],
    teiger: [],
    vegadresser: [],
  };

  for (const barn of op.then ?? []) {
    if (barn.op !== "move" || barn.then?.length) {
      throw new Error(`Ikke implementert: støtter bare enkle flyttinger, ikke "${barn.op}"`);
    }
    if (!STOTTEDE_KINDS.includes(barn.kind)) {
      throw new Error(`Ikke implementert: flytting av "${barn.kind}"`);
    }
    const til = kommunenummer(barn.to);
    grensejustering.tilKommunenummer ||= til;
    if (til !== grensejustering.tilKommunenummer) {
      throw new Error("Ikke implementert: en grensejustering kan bare flytte til én kommune");
    }
    const key = segmenter(barn.key);
    const [, , ...mal] = barn.to;

    if (barn.kind === "landNumber" || barn.kind === "titleNumber") {
      const [gardsnummer, bruksnummer] = key;
      const [nyGardsnummer, nyBruksnummer] = mal;
      grensejustering.matrikkelenheter.push({
        kommunenummer: fra,
        gardsnummer: Number(gardsnummer),
        bruksnummer: barn.kind === "landNumber" ? null : Number(bruksnummer),
        teigIder: [],
        ...(nyGardsnummer !== gardsnummer && { nyGardsnummer: Number(nyGardsnummer) }),
        ...(barn.kind === "titleNumber" &&
          nyBruksnummer !== bruksnummer && { nyBruksnummer: Number(nyBruksnummer) }),
      });
    } else if (barn.kind === "parcel") {
      grensejustering.teiger.push({ kommunenummer: fra, teigId: Number(key[0]) });
    } else if (barn.kind === "addressCode") {
      // Adressene på vegen er ikke i specen. Husnummeret er en plassholder, `heleVegen` er det som gjelder.
      grensejustering.vegadresser.push({
        kommunenummer: fra,
        veg: vegFraKode(key[0]),
        husnummer: { nummer: 0, bokstav: "" },
        nyVeg: vegFraKode(mal[0]),
        heleVegen: true,
      });
    } else if (barn.kind === "addressNumber") {
      const [adressekode, nummer] = key;
      const [nyAdressekode, nyttNummer] = mal;
      grensejustering.vegadresser.push({
        kommunenummer: fra,
        veg: vegFraKode(adressekode),
        husnummer: { nummer: Number(nummer), bokstav: "" },
        nyVeg: vegFraKode(nyAdressekode),
        ...(nyttNummer !== nummer && {
          nyttHusnummer: { nummer: Number(nyttNummer), bokstav: "" },
        }),
      });
    }
  }

  return grensejustering;
}

// Hver `adjust` på rotnivå er én grensejustering. Specen har ikke teig-IDene til
// matrikkelenhetene, adressenavn, husnummerbokstaver eller adressene på en veg som flyttes hel
// (`addressCode`), så de blir tomme eller får en plassholder.
export function fraReformSpec(id: number, spec: ReformSpec): ReguleringDetail {
  return {
    id,
    navn: spec.navn,
    dato: spec.ikrafttredelse,
    grensejusteringer: spec.operasjoner.map(fraAdjust),
  };
}
