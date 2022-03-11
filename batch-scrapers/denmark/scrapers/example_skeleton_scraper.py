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
import os

from company_service_client import Client
from company_service_client.api.company import (
    company_controller_insert_or_update,
    company_controller_companies,
)
from company_service_client.models import InsertOrUpdateDto

production = os.environ.get("PRODUCTION", False)
url = os.environ.get("API_URL", "http://127.0.0.1:3000")

client = Client(base_url=url, timeout=30.0, verify_ssl=production)

# TODO: Insert scraping code here, and use the call outlined below to insert companies
company_controller_insert_or_update.sync_detailed(
    client=client,
    json_body=[
        InsertOrUpdateDto(
            company_name="some company", country="DK", company_id="121212"
        ),
        InsertOrUpdateDto(
            company_name="some other company", country="DK", company_id="454545"
        ),
    ],
)

print(f"Added companies:")
print(company_controller_companies.sync_detailed(client=client).content)
