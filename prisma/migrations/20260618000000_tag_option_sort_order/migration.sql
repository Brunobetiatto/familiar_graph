ALTER TABLE "GLOBAL_TAG_GENDER_OPTION"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GLOBAL_TAG_RELATION"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_options AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "tagSlug" ORDER BY "label", "key") - 1 AS position
  FROM "GLOBAL_TAG_GENDER_OPTION"
)
UPDATE "GLOBAL_TAG_GENDER_OPTION" AS option
SET "sortOrder" = ranked_options.position
FROM ranked_options
WHERE option."id" = ranked_options."id";

WITH ranked_relations AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "tagSlug" ORDER BY "label", "key") - 1 AS position
  FROM "GLOBAL_TAG_RELATION"
)
UPDATE "GLOBAL_TAG_RELATION" AS relation
SET "sortOrder" = ranked_relations.position
FROM ranked_relations
WHERE relation."id" = ranked_relations."id";
