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

## Error reporting by individual scrapers

There are a few things that can go wrong in an individual scraper. The main principles for error
handling and reporting are:

- Use the scraper's `constructor()` method to flag as warnings any potential issues, e.g.,
  misconfigurations. There's no guarantee that the scraper will ever be used in a request, so
  avoid throwing errors at this stage.
- Move validation for whether a request is applicable to the scraper to the `check()` method.
  Provide a descriptive message if a request is not applicable. This should be based only on
  the content of the particular request, not potential misconfigurations.
- In the `lookup()` method, use `throw` statements to raise problems that make the scraper unable
  to continue with the operation. Some examples of situations that should throw errors include:

      - The scraper is misconfigured (e.g. missing credentials).
      - A service you're contacting is unavailable.
      - There are problems parsing the response, such as unexpected format.

  Problems related to the content of the request should have been filtered out in the `check()`
  operation.

  Thrown errors are caught by `ScraperRegistry` and reported upstream with the name of the scraper
  and a `HttpStatus`of `INTERNAL_SERVICE_ERROR`.

See the `DenmarkScraper` for an example of how these principles are applied.
