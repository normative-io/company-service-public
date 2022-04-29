# Danish country specific scraper

The danish government maintains a [complete public list](https://datacvr.virk.dk/data/) of all registered companies in
Denmark.

The database is queriable to anyone who has signed up as a user on their public system. The signup process is
described in their
[B2B access guide](https://data.virk.dk/datakatalog/erhvervsstyrelsen/system-til-system-adgang-til-cvr-data) (in
danish).

The API is using elastic search to allow querying the registered companies.

## Configuration

Once the signup process is completed, [Virk](https://virk.dk) will provide a username and a password which is needed to
query company information. The `DenmarkScraper` expects the environment variables `DK_VIRK_USERNAME` and
`DK_VIRK_PASSWORD` to contain the username and password, respectively.

## Data model

The data used by the repository in this scraper relies on a mapping from danish localized SICs to NACE, and on a
mapping from NACE to ISIC. The `scripts/scrapper-mapping` folder in the root of this repository contains scripts to
generate the mapping data needed for this.
