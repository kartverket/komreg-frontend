import type { Kind, KeySpec, MoveOp, OpSpec, PathSpec, ReformSpec } from "@/types/ReformSpec";
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

// Bokstaven på et husnummer kan ikke uttrykkes i formatet, siden `addressNumber` bare er et tall.
export function tilReformSpec({
  navn,
  dato,
  grensejustering,
}: OpprettReguleringRequest): ReformSpec {
  const fra = kommuneNokkel(grensejustering.fraKommunenummer);
  const til = kommuneNokkel(grensejustering.tilKommunenummer);
  const operasjoner: OpSpec[] = [];

  for (const enhet of grensejustering.matrikkelenheter) {
    const nytt = nyttMatrikkelnummer(enhet);
    const hel = enhet.bruksnummer === null || nytt.bruksnummer === null;
    const op: MoveOp = hel
      ? {
          op: "move",
          kind: "landNumber",
          key: [...fra, enhet.gardsnummer],
          to: [...til, nytt.gardsnummer],
        }
      : {
          op: "move",
          kind: "titleNumber",
          key: [...fra, enhet.gardsnummer, enhet.bruksnummer!],
          to: [...til, nytt.gardsnummer, nytt.bruksnummer!],
        };
    operasjoner.push(op);
  }

  for (const teig of grensejustering.teiger) {
    operasjoner.push({
      op: "move",
      kind: "parcel",
      key: [...fra, teig.teigId],
      to: [...til, teig.teigId],
    });
  }

  const flyttedeVeger = new Set<number>();
  for (const { veg, husnummer, nyVeg, nyttHusnummer, heleVegen } of grensejustering.vegadresser) {
    if (heleVegen) {
      // Hver adresse på vegen gir en egen draft, men vegen skal bare flyttes én gang.
      if (flyttedeVeger.has(veg.adressekode)) continue;
      flyttedeVeger.add(veg.adressekode);
      operasjoner.push({
        op: "move",
        kind: "addressCode",
        key: [...fra, veg.adressekode],
        to: [...til, veg.adressekode],
      });
      continue;
    }
    operasjoner.push({
      op: "move",
      kind: "addressNumber",
      key: [...fra, veg.adressekode, husnummer.nummer],
      to: [...til, (nyVeg ?? veg).adressekode, (nyttHusnummer ?? husnummer).nummer],
    });
  }

  return { navn, ikrafttredelse: dato, operasjoner };
}

const STOTTEDE_KINDS: Kind[] = [
  "landNumber",
  "titleNumber",
  "parcel",
  "addressCode",
  "addressNumber",
];

function kommunenummer(nokkel: KeySpec | PathSpec): string {
  const [fylke, kommune] = Array.isArray(nokkel) ? nokkel : [];
  return `${fylke}${kommune}`;
}

// Specen har bare adressekoden, så navnet vises som koden.
function vegFraKode(adressekode: string | number | undefined): Veg {
  return { adressekode: Number(adressekode), adressenavn: `Adressekode ${adressekode}` };
}

// Støtter bare `move`-operasjonene på rotnivå, som er det tilReformSpec lager, og kaster på alt annet
// i stedet for å vise en ufullstendig reform. Specen har ikke
// teig-IDene til matrikkelenhetene, adressenavn, husnummerbokstaver eller adressene på en veg som
// flyttes hel (`addressCode`), så de blir tomme eller får en plassholder.
export function fraReformSpec(id: number, spec: ReformSpec): ReguleringDetail {
  const grensejustering: GrensejusteringDraft = {
    fraKommunenummer: "",
    tilKommunenummer: "",
    matrikkelenheter: [],
    teiger: [],
    vegadresser: [],
  };

  for (const op of spec.operasjoner) {
    if (op.op !== "move" || !Array.isArray(op.key) || op.then?.length) {
      throw new Error(`Ikke implementert: støtter bare enkle flyttinger, ikke "${op.op}"`);
    }
    if (!STOTTEDE_KINDS.includes(op.kind)) {
      throw new Error(`Ikke implementert: flytting av "${op.kind}"`);
    }
    const key = op.key;
    const fra = kommunenummer(key);
    const til = kommunenummer(op.to);
    grensejustering.fraKommunenummer ||= fra;
    grensejustering.tilKommunenummer ||= til;
    if (fra !== grensejustering.fraKommunenummer || til !== grensejustering.tilKommunenummer) {
      throw new Error("Ikke implementert: støtter bare flytting mellom to kommuner");
    }

    if (op.kind === "landNumber" || op.kind === "titleNumber") {
      const [, , gardsnummer, bruksnummer] = key;
      const [, , nyGardsnummer, nyBruksnummer] = op.to;
      grensejustering.matrikkelenheter.push({
        kommunenummer: fra,
        gardsnummer: Number(gardsnummer),
        bruksnummer: op.kind === "landNumber" ? null : Number(bruksnummer),
        teigIder: [],
        ...(nyGardsnummer !== gardsnummer && { nyGardsnummer: Number(nyGardsnummer) }),
        ...(op.kind === "titleNumber" &&
          nyBruksnummer !== bruksnummer && { nyBruksnummer: Number(nyBruksnummer) }),
      });
    } else if (op.kind === "parcel") {
      grensejustering.teiger.push({ kommunenummer: fra, teigId: Number(key[2]) });
    } else if (op.kind === "addressCode") {
      // Adressene på vegen er ikke i specen. Husnummeret er en plassholder, `heleVegen` er det som gjelder.
      grensejustering.vegadresser.push({
        kommunenummer: fra,
        veg: vegFraKode(key[2]),
        husnummer: { nummer: 0, bokstav: "" },
        nyVeg: vegFraKode(op.to[2]),
        heleVegen: true,
      });
    } else if (op.kind === "addressNumber") {
      const [, , adressekode, nummer] = key;
      const [, , nyAdressekode, nyttNummer] = op.to;
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

  return { id, navn: spec.navn, dato: spec.ikrafttredelse, grensejustering };
}
