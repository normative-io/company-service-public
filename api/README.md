# Company Service API

The primary entrypoint for clients of the company service.

Note that `find` operations require the ScraperService to be
up and running.

## Installation

```bash
$ npm install
```

## Running

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Running in Docker

Note that the `docker-compose` file is in the parent folder; this is
because Company Service API depends on Scraper Service being up and
running, and this dependency is reflected in such file.

IMPORTANT: Before starting the application in Docker, change the value
of `scraperServiceAddress` in the `company.service.ts` file to point to
`scraper_dev` (instead of `127.0.0.1`).

TODO: Use configuration files to inject the proper value depending
on the environment.

```bash
# development. Note that this command starts scraper_dev too.
$ (cd .. && docker-compose up api_dev)

# production mode: TODO
```

## Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
