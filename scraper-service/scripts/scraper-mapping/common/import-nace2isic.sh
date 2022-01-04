#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

outname="../../../../scraper-service/src/scraper/common/isicmapping.json"

rm -f isicmapping.db
sqlite3 isicmapping.db < nace2isic-create.sql
sqlite3 isicmapping.db < nace2isic-import.sql
sqlite3 isicmapping.db < nace2isic-adapter.sql > $outname
rm isicmapping.db
npx prettier --print-width 120 -w $outname
