import type { components } from "@/api/regulering-api";
import { fraReformSpec, tilReformSpec, type ReformSpec } from "@/domain/reformSpec";
import type {
  OpprettReguleringRequest,
  ReguleringDetail,
  ReguleringSummary,
} from "@/domain/regulering";
import type { Veg, VegadresseDraft } from "@/domain/vegadresse";
import { finnVegnavn } from "@/utils/AdresseUtils";

type Schemas = components["schemas"];

const KAN_IKKE_LAGRES = "Reguleringen kunne ikke lagres på serveren";
const KAN_IKKE_HENTES = "Reguleringen kunne ikke hentes fra serveren";

// Dev-proxyen og Caddy fjerner /api/regulering før kallet når regulering-api.
function reguleringerUrl(sti = ""): URL {
  return new URL(`/api/regulering/api/reguleringer${sti}`, window.location.origin);
}

// Nettverksfeil og uventede svar gir `feilmelding`. 404 og valideringsfeil (422) fra
// regulering-api får egne meldinger.
async function kall(url: URL, feilmelding: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(feilmelding);
  }
  if (res.ok) return res;
  if (res.status === 404) throw new Error("Fant ikke reguleringen");
  if (res.status === 422) {
    const { feil } = (await res.json()) as Schemas["ValideringResultat"];
    if (feil.length) throw new Error(feil.map(({ melding }) => melding).join(" "));
  }
  throw new Error(feilmelding);
}

function sendSpec(url: URL, method: "POST" | "PUT", request: OpprettReguleringRequest) {
  const spec: ReformSpec = tilReformSpec(request);
  return kall(url, KAN_IKKE_LAGRES, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
}

export async function createRegulering(request: OpprettReguleringRequest): Promise<number> {
  const res = await sendSpec(reguleringerUrl(), "POST", request);
  const { id } = (await res.json()) as Schemas["OpprettetRegulering"];
  return id;
}

export async function updateRegulering(
  id: number,
  request: OpprettReguleringRequest,
): Promise<void> {
  await sendSpec(reguleringerUrl(`/${id}`), "PUT", request);
}

export async function listReguleringer(): Promise<ReguleringSummary[]> {
  const res = await kall(reguleringerUrl(), "Reguleringer kunne ikke hentes fra serveren");
  return (await res.json()) as Schemas["ReformSammendrag"][];
}

function medNavn(veg: Veg, navn: ReadonlyMap<number, string>): Veg {
  const adressenavn = navn.get(veg.adressekode);
  return adressenavn ? { ...veg, adressenavn } : veg;
}

function unike(koder: number[]): number[] {
  return [...new Set(koder)];
}

// Feiler oppslaget, vises adressekodene i stedet for at hele reguleringen feiler.
function finnVegnavnEllerIngen(kommunenummer: string, adressekoder: number[]) {
  return finnVegnavn(kommunenummer, unike(adressekoder)).catch(() => new Map<number, string>());
}

// Specen har bare adressekodene, så navnene hentes fra adresse-API-et. Veger som ikke finnes
// der, beholder plassholderen fra fraReformSpec.
async function medVegnavn(
  vegadresser: VegadresseDraft[],
  fraKommunenummer: string,
  tilKommunenummer: string,
): Promise<VegadresseDraft[]> {
  if (!vegadresser.length) return vegadresser;
  const [fraNavn, tilNavn] = await Promise.all([
    finnVegnavnEllerIngen(
      fraKommunenummer,
      vegadresser.map(({ veg }) => veg.adressekode),
    ),
    finnVegnavnEllerIngen(
      tilKommunenummer,
      vegadresser.flatMap(({ nyVeg }) => (nyVeg ? [nyVeg.adressekode] : [])),
    ),
  ]);
  return vegadresser.map((adresse) => ({
    ...adresse,
    veg: medNavn(adresse.veg, fraNavn),
    ...(adresse.nyVeg && { nyVeg: medNavn(adresse.nyVeg, tilNavn) }),
  }));
}

export async function getRegulering(id: number): Promise<ReguleringDetail> {
  const res = await kall(reguleringerUrl(`/${id}`), KAN_IKKE_HENTES);
  const regulering = fraReformSpec(id, (await res.json()) as ReformSpec);
  const { fraKommunenummer, tilKommunenummer, vegadresser } = regulering.grensejustering;
  return {
    ...regulering,
    grensejustering: {
      ...regulering.grensejustering,
      vegadresser: await medVegnavn(vegadresser, fraKommunenummer, tilKommunenummer),
    },
  };
}
