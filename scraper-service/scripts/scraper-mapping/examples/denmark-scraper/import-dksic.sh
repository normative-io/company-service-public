#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

outname="../../../../../scraper-service/src/scraper/examples/denmark-scraper/repository/dksicmapping.json"

rm -f sicmapping.db
sqlite3 sicmapping.db < dksic-create.sql
sqlite3 sicmapping.db < dksic-import.sql
sqlite3 sicmapping.db < dksic-adapter.sql > $outname
rm sicmapping.db
npx prettier --print-width 120 -w $outname
