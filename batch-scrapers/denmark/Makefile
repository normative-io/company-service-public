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
DEFAULT_GOAL: run
.PHONY: clean dep test run tidy typecheck company-service-client

build: company-service-client 
	poetry install

run: company-service-client
	poetry run python scrapers/denmark_scraper.py download upload

typecheck:
	poetry run mypy src test scrapers company-service-client

test:
	poetry run pytest --disable-pytest-warnings --log-cli-level WARNING -vv 

tidy:
	poetry run isort src test scrapers
	poetry run black src test scrapers

check:
	make tidy 
	make typecheck 
	make test 

clean: clean-venv

run-services:
	docker compose -f ../../docker-compose.yml \
		-f docker/docker-compose.generate-client.yml \
		up \
		--abort-on-container-exit \
		--exit-code-from api_ready api_ready

company-service-client: company-service-client/company_service_client/README.md

company-service-client/company_service_client/README.md:
	make run-services
	( \
		rm -rf company-service-client; \
		pipx run openapi-python-client generate --config openapi_config.yaml --url http://127.0.0.1:3000/api/json; \
	)
