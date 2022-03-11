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
import asyncio
import logging
from pathlib import Path
from typing import Optional

import click

from normative_batch_scrapers.scraper.denmark.scraper import (
    UploaderSettings,
    download_stream,
    target_directory,
    transform,
    upload,
)
from normative_batch_scrapers.scraper.denmark.scrolldownloader import DownloaderSettings
from normative_batch_scrapers.util import coro

log = logging.getLogger(__name__)


@click.group(chain=True)
@click.option(
    "--directory",
    type=click.Path(exists=True, dir_okay=True, path_type=Path),
    help="User-defined directory to use for storage. Defaults to a tempdir if not supplied.",
)
@click.option("-v", "--verbose", is_flag=True, default=False)
@click.pass_context
@coro
async def cli(ctx, directory: Optional[Path], verbose: bool):
    """
    Company information scraper for Danish companies.

    Gathers information from the Danish Virk authority and uploads to the Company Service.
    """
    if verbose:
        logging.basicConfig(level=logging.DEBUG)
        logging.getLogger("httpx").setLevel(logging.WARNING)
    else:
        logging.basicConfig(level=logging.INFO)
    ctx.obj = ctx.with_resource(target_directory(directory))


@cli.command(
    "download",
    help="Downloads company information from the Danish authorities",
)
@click.option(
    "--scroll-limit",
    type=int,
    help="limit the number of scroll pages to download (for debug purposes)",
)
@click.option(
    "--scroll-page-size",
    type=int,
    default=2000,
    help="the number of companies to request per scroll request",
)
@click.pass_obj
@coro
async def download_cmd(
    obj: Path,
    scroll_limit: Optional[int],
    scroll_page_size: int,
):
    log.info("Executing denmark downloader command")
    settings = DownloaderSettings(
        scroll_limit=scroll_limit, scroll_page_size=scroll_page_size
    )
    await download_stream(settings, write_path=obj)


@cli.command(
    "upload",
    help="Upload company information to the Company Service",
)
@click.option(
    "--batch-size",
    type=int,
    default=1000,
    help="Nbr of companies to upload per batch",
)
@click.pass_obj
@coro
async def upload_cmd(obj: Path, batch_size: int):
    log.info("Executing denmark upload command")
    settings = UploaderSettings(batch_size=batch_size)
    cdtos = await transform(read_path=obj)
    await upload(upload_settings=settings, dtos=cdtos)


if __name__ == "__main__":
    asyncio.run(cli())
