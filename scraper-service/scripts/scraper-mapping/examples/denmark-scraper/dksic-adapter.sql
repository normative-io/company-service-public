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
