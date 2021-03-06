# Company Service

A set of microservices that provide clients a way to look up metadata about companies across the world.

## Project Structure

This repo contains several loosely-coupled microservices. To develop on a particular microservice, `cd` into the corresponding folder.

- `api/` - the entrypoint for external clients.
- `scraper-service/` - subsystem that provides on-demand scraping of company metadata.
- `batch-scrapers/` - batch scrapers which will be run peridically to pre-fill company-service with company metadata.

## Building and running

To get everything up and running, there are a few routes to go:

- Running on host system, for development
- Running dockerized with a local image, for testing purposes
- Running in Kubernetes with a remote image

Take either approach, depending on your use-case, but rarely both or a combination of the two.

### Running on host system (for development)

Runnning locally means starting each service independently. Each service has its own README file
which describes the process, but it is generally something along the lines of:

```
cd <service>
nvm use
npm install
npm start
```

See each service's `.env` file for configuration options.

### Running dockerized with a local image (for testing)

Running in docker is as simple as:

```
docker compose up
```

To ensure that what you are running is the latest, you may want to make really sure that everything is
rebuilt before running:

```
docker compose build --no-cache
docker compose up
```

Some services use a different dotenv file when running in Docker, see
the `docker-compose.yml` to find the relevant dotenv file's.

### Running in Kubernetes with a remote image (API only)

See [kube/README.md](kube/README.md).

### Known issues

There's no place like the actual code to document issues. Search for `TODO`
to see small-ish issues, and `GOTCHA` for longer design discussions.

## Contributing

This project is maintained by Normative but currently not actively seeking external contributions. If you however are interested in contributing to the project please [sign up here](https://docs.google.com/forms/d/e/1FAIpQLSe80c9nrHlAq6w2vUbeFSPVGG7IPqorKMkizhHJ98viwnT-OA/viewform?usp=sf_link) or come [join us](https://normative.io/jobs/).

Thank you to all the people from Google.org who were critical in making this project a reality!
- Carmen Ruiz Vicente: ([@carmrui](https://github.com/carmrui))
- Dan Radion: ([@danradion](https://github.com/danradion))

## License
Copyright (c) Meta Mind AB. All rights reserved.

Licensed under the [Apache-2.0 license](/LICENSE)
