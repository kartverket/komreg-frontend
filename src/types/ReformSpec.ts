export type Kind =
  | "county"
  | "municipality"
  | "addressCode"
  | "addressNumber"
  | "districtType"
  | "districtNumber"
  | "landNumber"
  | "titleNumber"
  | "parcel";

/** Ett ledd i en nøkkel. Fylke og kommune er strenger, resten tall (unntatt `districtType`). */
export type Segment = string | number;

/** Pivot relativt til konteksten: ett segment, eller en sti av segmenter som slutter på `kind`. */
export type PathSpec = Segment | Segment[];

/** Full nøkkel fra roten. Brukes for mål (`to`, `derivedFrom`, `existing`, `new`). */
export type KeySpec = Segment[];

export type Koordinatsystem = "UTM32" | "UTM33" | "UTM35" | "UKJENT";

export type Koordinat = {
  x: number;
  y: number;
};

export type Gardsnummerserie = {
  fra: number;
  til: number;
};

export type KommuneAdresse = {
  adresselinje1?: string | null;
  adresselinje2?: string | null;
  postnummer: string;
};

export type FylkePayload = {
  navn: string;
};

export type KommunePayload = {
  navn: string;
  koordinatsystem: Koordinatsystem;
  senterpunkt: Koordinat;
  /** Standard `false`. */
  nedsattKonsesjonsgrense?: boolean;
  godkjenteGardsnumre?: Gardsnummerserie[];
  adresse?: KommuneAdresse | null;
  standardRekvirentOrgnummer?: string | null;
  /** Base64. */
  kommunevapen?: string | null;
};

export type Payload = FylkePayload | KommunePayload;

export type CreateOp = {
  op: "create";
  kind: Kind;
  key: PathSpec;
  derivedFrom?: KeySpec;
  payload?: Payload;
  then?: CreateOp[];
};

export type MoveOp = {
  op: "move";
  kind: Kind;
  key: PathSpec;
  to: KeySpec;
  then?: SourceOpSpec[];
};

export type SplitPartNew = {
  new: KeySpec;
  payload?: Payload;
  role?: "identity" | "successor";
  then?: CreateOp[];
};

export type SplitPartExisting = {
  existing: KeySpec;
  role: "successor";
  then?: OpSpec[];
};

export type SplitPart = SplitPartNew | SplitPartExisting;

export type SplitOp = {
  op: "split";
  kind: Kind;
  key: PathSpec;
  into: SplitPart[];
  then?: SourceOpSpec[];
};

export type MergeSource = {
  key: PathSpec;
  then?: SourceOpSpec[];
};

export type SourceSpec = PathSpec | MergeSource;

export type MergeIntoExisting = {
  existing: KeySpec;
  then?: OpSpec[];
};

export type MergeIntoNew = {
  new: KeySpec;
  payload?: Payload;
  then?: CreateOp[];
};

export type MergeInto = MergeIntoExisting | MergeIntoNew;

export type MergeOp = {
  op: "merge";
  kind: Kind;
  /** Minst én kilde. */
  from: SourceSpec[];
  into: MergeInto;
};

export type AdjustOp = {
  op: "adjust";
  kind: Kind;
  key: PathSpec;
  then?: OpSpec[];
};

/** Operasjoner som er lov under en kilde. */
export type SourceOpSpec = MoveOp | SplitOp | MergeOp;

export type OpSpec = AdjustOp | MoveOp | MergeOp | SplitOp | CreateOp;

export type ReformSpec = {
  /** Versjon av formatet. Standard `1`, alltid med i API-svar. */
  format?: number;
  navn: string;
  /** `ÅÅÅÅ-MM-DD`. */
  ikrafttredelse: string;
  operasjoner: OpSpec[];
};
