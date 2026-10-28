type GeomPoint = {
  epsg?: string;
  lat: number;
  lon: number;
};

export type Address = {
  adressenavn?: string;
  adressetekst?: string;
  adressetilleggsnavn?: string;
  adressekode?: number;
  nummer?: number;
  bokstav?: string;
  kommunenummer?: string;
  kommunenavn?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  festenummer?: number;
  undernummer?: number;
  bruksenhetsnummer?: string[];
  objtype?: "Vegadresse" | "Matrikkeladresse";
  poststed?: string;
  postnummer?: string;
  adressetekstutenadressetilleggsnavn?: string;
  stedfestingverifisert?: boolean;
  representasjonspunkt?: GeomPoint;
  oppdateringsdato?: string;
};
