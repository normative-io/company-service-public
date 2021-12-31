# Scraper Service

Subsystem that provides on-demand scraping. Requests typically come directly from the company-service whenever some metadata is not found in the primary database.

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

Note that the `docker-compose` file is in the parent folder.

```bash
# development
$ (cd .. && docker-compose up scraper_dev)

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
