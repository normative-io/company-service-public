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
    'formatted', formatted_nace,
    'nace', NACE,
    'isic', ISIC
  )
) AS json_result
FROM (
  SELECT
    formatted_nace,
    NACE,
    ISIC
  FROM nace2isic
  WHERE
    formatted_nace <> 'formatted_nace' AND -- exclude header
    formatted_nace <> 'Source' AND -- exclude formatted nace groups
    NACE <> '' -- exclude nace groups
);
