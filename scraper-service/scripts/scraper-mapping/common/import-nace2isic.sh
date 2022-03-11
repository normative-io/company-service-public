#!/usr/bin/env bash
# Copyright 2022 Meta Mind AB
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -e

cd "$(dirname "$0")"

outname="../../../src/scraper/common/isicmapping.json"
mkdir -p "$(dirname $outname)"

rm -f isicmapping.db
sqlite3 isicmapping.db < nace2isic-create.sql
sqlite3 isicmapping.db < nace2isic-import.sql
sqlite3 isicmapping.db < nace2isic-adapter.sql > $outname
rm isicmapping.db
npx prettier --config=../../../.prettierrc -w $outname
