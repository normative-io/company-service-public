# Scrapper mapping scripts

These scripts are used to generate model data needed for mapping localized SICs to ISICs.

The source of truth is stored in .xlsx files in the relevant folders. Each folder also includes a .tsv file exported
from said .xlsx file, which in turn is used to generate .json mapping files.

## Running the generator scripts

The generator scripts are implicitly run as part of the npm scripts whenever they are needed. They can be run
explicitly by running `npm run generate-models`.
