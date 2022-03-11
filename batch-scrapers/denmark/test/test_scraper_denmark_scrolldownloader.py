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
import pytest

from normative_batch_scrapers.scraper.denmark.scrolldownloader import (
    DownloaderSettings,
    scroll,
)
from normative_batch_scrapers.util import aenumerate


@pytest.mark.asyncio
@pytest.mark.skip("manually hydrate the example responses")
async def test_initial_scroll_post() -> None:
    downloader_settings = DownloaderSettings(scroll_limit=5, scroll_page_size=2)
    async for i, resp in aenumerate(scroll(downloader_settings, raw=True)):
        with open(f"test/data/example_resp_{i}.json", mode="w") as f:
            f.write(resp)
