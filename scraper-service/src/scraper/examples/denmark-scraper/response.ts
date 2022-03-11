// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
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
