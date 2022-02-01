# Scraper Service

Subsystem that provides on-demand scraping. Requests typically come directly from the company-service whenever some metadata is not found in the primary database.

## Prerequisites

Besides [node](https://nodejs.org/), [nvm](https://github.com/nvm-sh/nvm) should also be installed locally.

## Installation

```bash
$ nvm use
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

See the main project's README.md.

## Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
