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

SELECT json_group_array(
  json_object(
    'dksic', `6-kode`,
    'nace', `4-kode`,
    'description', Tekst
  )
) AS json_result
FROM (
  SELECT
    `6-kode`,
    `4-kode`,
    Tekst
  FROM dksic 
  WHERE
  `6-kode` <> '6-kode' AND -- exclude header
  `4-kode` <> '' AND -- exclude NACE groups
  `6-kode` <> '' -- exclude SIC groups
);
