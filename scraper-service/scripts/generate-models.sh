#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

scraper-mapping/common/import-nace2isic.sh 2>/dev/null
scraper-mapping/examples/denmark-scraper/import-dksic.sh 2>/dev/null
