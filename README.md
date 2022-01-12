# Company Service

A set of microservices that provide clients a way to look up metadata about companies across the world.

## Project Structure

This repo contains several loosely-coupled microservices. To develop on a particular microservice, `cd` into the corresponding folder.

- `api/` - the entrypoint for external clients.
- `scraper-service/` - subsystem that provides on-demand scraping of company metadata.

## Building and running

To get everything up and running, there are two routes to go:

- Running on host system, for development
- Running dockerized, for testing purposes

Take either approach, depending on your use-case, but rarely both or a combination of the two.

### Running on host system

Runnning locally means starting each service independently. Each service will have its own README file
which describes the process, but it is generally something along the lines of:

```
cd <service>
nvm use
npm install
npm start
```

### Running dockerized

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
