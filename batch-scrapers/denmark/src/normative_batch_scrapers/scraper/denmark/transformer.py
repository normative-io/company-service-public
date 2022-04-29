# Copyright 2022 Meta Mind AB
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import logging
import operator
from dataclasses import dataclass
from http.client import responses
from pydoc import visiblename
from tkinter.font import names
from typing import AsyncIterable, Iterable, Mapping, Optional

from company_service_client.models.create_company_dto import CreateCompanyDto

from normative_batch_scrapers.scraper.denmark.classification_mappings import (
    Classification,
    DkSic,
    make_mappings,
)
from normative_batch_scrapers.scraper.denmark.response_parser import (
    Hit,
    ParsedResponse,
    Vrvirksomhed,
)

log = logging.getLogger(__name__)


def _extract_name(virksomhed: Vrvirksomhed) -> Optional[str]:
    names_by_valid_to = sorted(
        virksomhed.navne,
        key=lambda x: (x.periode.gyldig_til is None, x.periode.gyldig_til),
        reverse=True,
    )
    if not names_by_valid_to:
        return None
    return names_by_valid_to[0].navn


def _extract_localized_sic(company: Vrvirksomhed) -> Optional[DkSic]:
    dksic_by_valid_to = sorted(
        company.hovedbranche,
        key=lambda x: (x.periode.gyldig_til is None, x.periode.gyldig_til),
        reverse=True,
    )
    if not dksic_by_valid_to:
        return None
    return DkSic(dksic_by_valid_to[0].branchekode)


@dataclass
class CompanyTransformer:
    classification_mappings: Mapping[DkSic, Classification]

    def _transform_company(self, company: Vrvirksomhed) -> Iterable[CreateCompanyDto]:
        tax_id = str(company.cvr_nummer)
        if not (name := _extract_name(company)):
            return
        if not (localized_sic := _extract_localized_sic(company)):
            return
        if not (classification := self.classification_mappings.get(localized_sic)):
            return
        yield CreateCompanyDto(
            company_name=name, country="DK", company_id=tax_id, isic=classification.isic
        )

    def transform(self, response: ParsedResponse) -> Iterable[CreateCompanyDto]:
        for hit in response.hits.hits:
            yield from self._transform_company(hit.source.vrvirksomhed)


def create_company_transformer() -> CompanyTransformer:
    return CompanyTransformer(classification_mappings=make_mappings())
