import asyncio
import logging
from dataclasses import dataclass
from typing import AsyncIterable, Literal, NewType, Optional, Union, overload
from urllib.parse import urlencode, urljoin

import httpx
from pydantic import BaseSettings, Field, SecretStr

from normative_batch_scrapers.scraper.denmark.response_parser import (
    ParsedResponse,
    ScrollId,
)
from normative_batch_scrapers.util import retry_async

log = logging.getLogger(__name__)


class RetrySettings(BaseSettings):
    nbr_of_retries: int = 3
    cooldown_in_ms: int = 50


class DownloaderSettings(BaseSettings):
    username: SecretStr = Field(..., env="DK_VIRK_USERNAME")
    password: SecretStr = Field(..., env="DK_VIRK_PASSWORD")
    scroll_page_size: int = 2000
    scroll_timeout: int = 1
    scroll_limit: Optional[int] = None
    retry_settings: RetrySettings = RetrySettings()

    class Config:
        env_file = "envs/denmark.env"
        env_file_encoding = "utf-8"


_BASE_URL = "http://distribution.virk.dk"


def _build_initial_url(settings: DownloaderSettings) -> str:
    path = f"/cvr-permanent/virksomhed/_search"
    query = "?" + urlencode(dict(scroll=f"{settings.scroll_timeout}m"))
    return urljoin(_BASE_URL, path + query)


def _build_subsequent_scroll_url(scroll_timeout: int, scroll_id: str) -> str:
    path = f"/_search/scroll"
    query = "?" + urlencode(dict(scroll=f"{scroll_timeout}m", scroll_id=scroll_id))
    return urljoin(_BASE_URL, path + query)


def _build_initial_request(batch_size: int) -> dict:
    d = {
        "query": {"match_all": {}},
        "size": batch_size,
    }
    return d


RawResponse = NewType("RawResponse", str)


async def _fetch_next_scroll_page(
    client: httpx.AsyncClient, settings: DownloaderSettings, scroll_id: str
) -> tuple[ScrollId, RawResponse, ParsedResponse]:
    url = _build_subsequent_scroll_url(settings.scroll_timeout, scroll_id)
    resp = await retry_async(
        client.get,
        nbr_of_retries=settings.retry_settings.nbr_of_retries,
        cooldown_in_ms=settings.retry_settings.cooldown_in_ms,
    )(
        url,
        auth=httpx.BasicAuth(
            username=settings.username.get_secret_value(),
            password=settings.password.get_secret_value(),
        ),
    )
    pr = ParsedResponse.parse_raw(resp.text)
    return pr.scroll_id, RawResponse(resp.text), pr


async def _initiate_scroll_download(
    client: httpx.AsyncClient,
    settings: DownloaderSettings,
) -> tuple[ScrollId, RawResponse, ParsedResponse]:
    url = _build_initial_url(settings)
    data = _build_initial_request(settings.scroll_page_size)
    resp = await retry_async(
        client.post,
        nbr_of_retries=settings.retry_settings.nbr_of_retries,
        cooldown_in_ms=settings.retry_settings.cooldown_in_ms,
    )(
        url,
        json=data,
        auth=httpx.BasicAuth(
            username=settings.username.get_secret_value(),
            password=settings.password.get_secret_value(),
        ),
    )
    pr = ParsedResponse.parse_raw(resp.text)
    return pr.scroll_id, RawResponse(resp.text), pr


@overload
def scroll(
    settings: DownloaderSettings, raw: Literal[True]
) -> AsyncIterable[RawResponse]:
    ...


@overload
def scroll(
    settings: DownloaderSettings, raw: Literal[False]
) -> AsyncIterable[ParsedResponse]:
    ...


async def scroll(
    settings: DownloaderSettings, raw: Literal[True, False] = False
) -> Union[AsyncIterable[RawResponse], AsyncIterable[ParsedResponse]]:
    async with httpx.AsyncClient() as client:
        i = 0
        scroll_id, initial_raw_resp, initial_resp = await _initiate_scroll_download(
            client, settings
        )
        yield initial_raw_resp if raw else initial_resp
        i += 1
        last_resp = initial_resp

        def over_scroll_limit(i: int) -> bool:
            if settings.scroll_limit is None:
                return False
            else:
                return i > settings.scroll_limit

        while not last_resp.is_empty() and not over_scroll_limit(i):
            scroll_id, next_raw_resp, next_resp = await _fetch_next_scroll_page(
                client, settings, scroll_id
            )
            yield next_raw_resp if raw else next_resp
            last_resp = next_resp
            i += 1
