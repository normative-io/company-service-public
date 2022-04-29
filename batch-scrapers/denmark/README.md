# Denmark background scraper

This scraper is used to scrape the Virk CVR registry of companies in Denmark.

## Prerequisites

As a minimum, you should have make, git, and python3 installed.
In addition some python specific tooling is needed to build and run the scraper.

- Tk enabled Python
  - Installation on Mac: `brew install python-tk` or `brew reinstall python-tk@3.10` where `3.10` is your python version.
  - Installation on Linux: `sudo apt-get install python-tk python3-tk tk-dev`
- `pipx` is used to invoke client generation (https://pypa.github.io/pipx/).
  - Installation on Mac: `brew install pipx && pipx ensurepath`
  - Installation on Linux: `pip install pipx && pipx ensurepath`
- `poetry` is used for project and dependency management (https://python-poetry.org/)
  - `pipx` can be used for installation: `pipx install poetry` (https://python-poetry.org/docs/master/#installing-with-pipx)

Also required credentials along with api urls must be supplied using env variables. The credential
env var names are `DK_VIRK_USERNAME` and `DK_VIRK_PASSWORD`. The system will attempt to load the env vars
from the .env file `.env` if the file exists. A template is supplied at `.env.template`
(`cp ./.env.template ./.env` and fill in credentials to use).

## Install dependencies and build project

To install and build run

```
make build
```

This will generate the required api client and install a poetry environment in `./.venv` with
all required dependencies.

## Test, format and typecheck project

The make target `check` will 
 1. format all source files in-place using `isort` and `black`.
 2. typecheck all source files using `mypy`.
 3. run all tests using `pytest`

## Running

To run the project, run:

```
make run
```

This will download all company data and then upload to the company service using transient storage.

In order to separately download responses to disk explicitly run the scraper using poetry:

```
poetry run python scrapers/denmark_scraper.py --directory <USER_SUPPLIED_DIRECTORY> download
```
