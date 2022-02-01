from dataclasses import dataclass
from typing import Mapping, Optional

from black import json
from pydantic import BaseModel, parse_obj_as

# TODO: generate these files to a better location
_DKSIC_MAPPING = "../../scraper-service/src/scraper/examples/denmark-scraper/repository/dksicmapping.json"
_ISIC_MAPPING = "../../scraper-service/src/scraper/common/isicmapping.json"


class DkSic(str):
    ...


class Nace(str):
    ...


class Isic(str):
    ...


class IsicMappingEntry(BaseModel):
    formatted: str
    nace: Nace
    isic: Isic


class DkSicMappingEntry(BaseModel):
    dksic: DkSic
    nace: Nace
    description: str


@dataclass
class DkSicMapping:
    nace_by_dksic: dict[DkSic, Nace]

    def lookup_dksic(self, dksic: DkSic) -> Optional[Nace]:
        return self.nace_by_dksic.get(dksic)


def _parse_dksic_entries(raw_s: str) -> Mapping[DkSic, Nace]:
    entries = parse_obj_as(list[DkSicMappingEntry], raw_s)
    return {e.dksic: e.nace for e in entries}


def _parse_isic_entries(raw_s: str) -> Mapping[Nace, Isic]:
    entries = parse_obj_as(list[IsicMappingEntry], raw_s)
    return {e.nace: e.isic for e in entries}


@dataclass
class Classification:
    nace: Nace
    isic: Isic


def make_mappings() -> Mapping[DkSic, Classification]:
    with open(_DKSIC_MAPPING, mode="r") as f:
        dksic_to_nace = _parse_dksic_entries(json.loads(f.read()))

    with open(_ISIC_MAPPING, mode="r") as f:
        nace_to_isic = _parse_isic_entries(json.loads(f.read()))

    # we ignore entries without corresponding ISIC codes as in the active scraper
    return {
        dksic: Classification(nace, isic)
        for dksic, nace in dksic_to_nace.items()
        if (isic := nace_to_isic.get(nace))
    }
