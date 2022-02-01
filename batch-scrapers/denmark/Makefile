DEFAULT_GOAL: run
.PHONY: clean dep test run tidy typecheck company-service-client

install: company-service-client 
	poetry install

run: company-service-client
	poetry run scrapers/denmark_scraper.py

typecheck:
	poetry run mypy src test scrapers

test:
	poetry run pytest --disable-pytest-warnings --log-cli-level WARNING -vv 

tidy:
	poetry run isort src test scrapers
	poetry run black src test scrapers

check:
	$(MAKE) tidy 
	$(MAKE) typecheck 
	$(MAKE) test 

clean: clean-venv

run-services:
	docker compose -f ../../docker-compose.yml \
		-f docker/docker-compose.generate-client.yml \
		up \
		--abort-on-container-exit \
		--exit-code-from api_ready api_ready

company-service-client: company-service-client/company_service_client/README.md

company-service-client/company_service_client/README.md:
	$(MAKE) run-services
	( \
		rm -rf company-service-client; \
		pipx run openapi-python-client generate --url http://127.0.0.1:3000/api/json; \
	)
