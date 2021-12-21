# Company Service

A set of microservices that provide clients a way to look up metadata about companies across the world.

## Project Structure

This repo contains several loosely-coupled microservices. To develop on a particular microservice, `cd` into the corresponding folder.

- `api/` - the entrypoint for external clients.
- `scraper-service/` - subsystem that provides on-demand scraping of company metadata.
