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
