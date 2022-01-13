# TODO: Replace VENV name with name of your scraper environment
VENV=company-service-scraper-skeleton

# Include OS dependent prerequisites
# $(shell uname) -> OS specific prerequisites target
# prerequisites-help -> Helper target which shows helpful text
include tasks/prerequisites.mk

# Include virtual environment helpers:
# $(VENV_DIR) -> OS specific venv target
# $(ACTIVATE) -> equivalent to "pyenv activate <VENV>"
# clean-venv -> virtualenv cleanup target
include tasks/venv.mk

DEFAULT_GOAL: run
.PHONY: venv clean dep run company-service-client

# Create virtual environment and install dependencies
dep: venv requirements.txt
	( \
		$(ACTIVATE) \
		python3 -m pip install --upgrade pip; \
		pip install -r requirements.txt \
	)

run: company-service-client
	( \
		$(ACTIVATE) \
		python3 src/scrape.py;\
	)

test:
	( \
		$(ACTIVATE) \
		pipenv run pytest --disable-pytest-warnings --log-cli-level WARNING -vv ;\
	)

# Install OS dependent prerequisites (see prerequisites.mk) and show helpful text
# All of these are included from prerequisites.mk
prerequisites: $(shell uname) prerequisites-help

clean: clean-venv

# Install and setup pyenv and virtualenv
# This is included from venv.mk
venv: $(VENV_DIR)

run-services:
	docker compose -f ../../docker-compose.yml \
		-f docker/docker-compose.generate-client.yml \
		up \
		--abort-on-container-exit \
		--exit-code-from api_ready api_ready

company-service-client: src/company_service_client/README.md

src/company_service_client/README.md:
	$(MAKE) run-services
	( \
		$(ACTIVATE) \
		openapi-python-client generate --url http://127.0.0.1:3000/api/json; \
		rm -rf src/company_service_client; \
		mv company-service-client/company_service_client src; \
		cp company-service-client/README.md src/company_service_client; \
		rm -rf company-service-client \
	)
