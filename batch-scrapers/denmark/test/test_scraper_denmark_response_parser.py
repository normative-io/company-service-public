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
from normative_batch_scrapers.scraper.denmark.response_parser import (
    parse_denmark_response,
)

_example_response_path = "test/data/example_initial_scroll_response.json"


def test_parse_single_item_response():
    with open(_example_response_path, mode="r") as f:
        resp = parse_denmark_response(f.read())
    print(resp)
