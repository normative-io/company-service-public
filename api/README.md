# Company Service API

The primary entrypoint for clients of the company service.

Note that `find` operations require the ScraperService to be
up and running.

## Prerequisites

Besides [node](https://nodejs.org/), [nvm](https://github.com/nvm-sh/nvm)
should also be installed locally.

## Installation

```bash
$ nvm use
$ npm install
```

## Configuration

See the `.env` file.

## Running for development and testing

```bash

# development
$ npm run start

# watch mode
$ npm run start:dev
```

**Cleanup**: The Company Service API requires a Mongo database. If there's no existing database,
the above commands will create it. To delete this database when you're done, run:

```bash
$ npm run stop:db
```

## Running in prod

TODO: Confirm the instructions for prod. `npm run start:prod` hasn't been tested yet.

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
