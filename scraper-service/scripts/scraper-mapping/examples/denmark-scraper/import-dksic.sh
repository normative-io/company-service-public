#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

outname="../../../../src/scraper/examples/denmark-scraper/repository/dksicmapping.json"
mkdir -p "$(dirname $outname)"

rm -f sicmapping.db
sqlite3 sicmapping.db < dksic-create.sql
sqlite3 sicmapping.db < dksic-import.sql
sqlite3 sicmapping.db < dksic-adapter.sql > $outname
rm sicmapping.db
npx prettier --config=../../../../.prettierrc -w $outname
