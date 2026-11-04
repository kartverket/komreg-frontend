type GeomPoint = {
  epsg?: string;
  lat: number;
  lon: number;
};

export type Address = {
  adressenavn?: string;
  adressetekst?: string;
  adressekode?: number;
  nummer?: number;
  bokstav?: string;
  kommunenummer?: string;
  representasjonspunkt?: GeomPoint;
};
