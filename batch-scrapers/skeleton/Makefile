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
