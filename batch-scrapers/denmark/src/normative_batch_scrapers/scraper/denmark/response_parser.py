from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class Periode(BaseModel):
    gyldig_fra: Optional[date] = Field(alias="gyldigFra")
    gyldig_til: Optional[date] = Field(alias="gyldigTil")


class Navne(BaseModel):
    navn: str
    periode: Periode


class HovedBranche(BaseModel):
    branchekode: int
    branchetekst: str
    periode: Periode


class Vrvirksomhed(BaseModel):
    cvr_nummer: int = Field(alias="cvrNummer")
    navne: list[Navne]
    hovedbranche: list[HovedBranche]


class Source(BaseModel):
    vrvirksomhed: Vrvirksomhed = Field(alias="Vrvirksomhed")


class Hit(BaseModel):
    source: Source = Field(alias="_source")


class Hits(BaseModel):
    hits: list[Hit]


class ScrollId(str):
    ...


class ParsedResponse(BaseModel):
    scroll_id: ScrollId = Field(alias="_scroll_id")
    hits: Hits

    def is_empty(self) -> bool:
        return not self.hits.hits


def parse_denmark_response(raw_response: str) -> ParsedResponse:
    return ParsedResponse.parse_raw(raw_response)
