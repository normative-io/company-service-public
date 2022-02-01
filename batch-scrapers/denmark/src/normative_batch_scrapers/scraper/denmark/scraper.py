import asyncio
import itertools
import logging
import tempfile
from concurrent.futures import ProcessPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

from company_service_client import Client
from company_service_client.api.company import company_controller_add_many
from company_service_client.models.create_company_dto import CreateCompanyDto
from pydantic import BaseSettings, Field, HttpUrl

from normative_batch_scrapers.scraper.denmark.response_parser import (
    parse_denmark_response,
)
from normative_batch_scrapers.scraper.denmark.scrolldownloader import (
    DownloaderSettings,
    scroll,
)
from normative_batch_scrapers.scraper.denmark.transformer import (
    create_company_transformer,
)
from normative_batch_scrapers.util import aenumerate, batch

log = logging.getLogger(__name__)


class UploaderSettings(BaseSettings):
    api_url: HttpUrl = Field(..., env="API_URL")
    verify_ssl: bool = Field(env="PRODUCTION", default=False)
    batch_size: int = 1000
    timeout: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


async def download_stream(settings: DownloaderSettings, write_path: Path):
    log.info(f"Download raw stream to local storage")
    if any(write_path.iterdir()):
        raise IOError(f"Download directory {write_path} is not empty")
    async for i, rawresp in aenumerate(scroll(settings, raw=True)):
        if i % 10 == 0:
            log.debug(f"Writing scollbatch {i}")
        p = write_path / f"{i}.json"
        with open(p, mode="w") as f:
            f.write(rawresp)


def _transform_file(p: Path) -> list[CreateCompanyDto]:
    transformer = create_company_transformer()
    with open(p) as f:
        parsed_response = parse_denmark_response(f.read())
    return list(transformer.transform(parsed_response))


async def transform(read_path: Path) -> list[CreateCompanyDto]:
    log.info("Explode responses into companies")
    files = [p for p in read_path.iterdir() if p.suffix == ".json"]
    nbr_of_files = len(files)
    chunks = []
    with ProcessPoolExecutor() as pool:
        tasks = [asyncio.wrap_future(pool.submit(_transform_file, f)) for f in files]
        for i, t in enumerate(asyncio.as_completed(tasks)):
            if i % 100 == 0:
                log.debug(f"Processed response {i}/{nbr_of_files}")
            chunk = await t
            chunks.append(chunk)
    companies = list(itertools.chain(*chunks))
    log.info(f"Extracted {len(companies)} companies")
    return companies


async def upload(
    upload_settings: UploaderSettings, dtos: list[CreateCompanyDto]
) -> None:
    log.info("Upload companies to server")
    client = Client(
        base_url=upload_settings.api_url,
        verify_ssl=upload_settings.verify_ssl,
        timeout=upload_settings.timeout,
    )

    # TODO: tune batch size and try limited concurrent uploads
    nbr_of_batches = len(dtos) // upload_settings.batch_size
    for i, b in enumerate(batch(dtos, n=upload_settings.batch_size)):
        if i % 10 == 0:
            log.debug(f"Uploading batch {i}/{nbr_of_batches}")
        await company_controller_add_many.asyncio_detailed(client=client, json_body=b)


@contextmanager
def target_directory(directory: Optional[Path]) -> Iterator[Path]:
    """
    Return a path resource to a valid storage directory. If no explicit path is
    supplied a path to a temporary directory is returned.
    """
    if directory:
        log.info(f"Using {directory.absolute()} for storage")
        if not directory.is_dir():
            raise IOError(f"Supplied path {directory} is not a valid directory")
        yield directory
    else:
        log.info("Using temporary directory for storage")
        with tempfile.TemporaryDirectory() as tdir:
            yield Path(tdir)
