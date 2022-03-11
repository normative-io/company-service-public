-- Copyright 2022 Meta Mind AB
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     https://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

CREATE TABLE dksic(
  ID varchar,
  Niveau varchar,
  Section varchar,
  Hovedgruppe varchar,
  Gruppe varchar,
  Undergruppe varchar,
  DB07 varchar,
  NB varchar,
  Tekst varchar,
  `2-kode` char(2),
  `3-kode` char(3),
  `4-kode` char(4),
  `6-kode` char(6)
);
