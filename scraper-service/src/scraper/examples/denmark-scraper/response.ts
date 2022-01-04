export class LocationAddress {
  periode: ValidPeriod;
  husnummerFra: number | null;
  husnummerTil: number | null;
  bogstavFra: string | null;
  bogstavTil: string | null;
  etage: number | null;
  sidedoer: string | null;
  conavn: string | null;
  postboks: string | null;
  vejnavn: string | null;
  postnummer: number;
  postdistrikt: string;
}

export class ValidPeriod {
  gyldigFra: string;
  gyldigTil: string;
}

export class VrvirksomhedClassification {
  branchekode: number;
  periode: ValidPeriod;
}

export class VrvirksomhedName {
  navn: string;
  periode: ValidPeriod;
}

export class Vrvirksomhed {
  cvrNummer: number;
  navne: VrvirksomhedName[];
  beliggenhedsadresse: LocationAddress[];
  hovedbranche: VrvirksomhedClassification[];
}

export class ResponseHitSource {
  Vrvirksomhed: Vrvirksomhed;
}

export class ResponseHit {
  _source: ResponseHitSource;
}

export class ResponseHits {
  total: number;
  hits: ResponseHit[];
}

export class VirkResponse {
  hits: ResponseHits;
}
