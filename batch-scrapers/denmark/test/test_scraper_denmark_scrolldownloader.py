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
