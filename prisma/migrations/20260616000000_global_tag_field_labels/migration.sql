ALTER TABLE "GLOBAL_TAG"
ADD COLUMN "genderLabel" TEXT NOT NULL DEFAULT 'Genero',
ADD COLUMN "birthDateLabel" TEXT NOT NULL DEFAULT 'Nascimento',
ADD COLUMN "deathDateLabel" TEXT NOT NULL DEFAULT 'Falecimento',
ADD COLUMN "bioLabel" TEXT NOT NULL DEFAULT 'Biografia',
ADD COLUMN "maleLabel" TEXT NOT NULL DEFAULT 'Masculino',
ADD COLUMN "femaleLabel" TEXT NOT NULL DEFAULT 'Feminino',
ADD COLUMN "otherLabel" TEXT NOT NULL DEFAULT 'Outro';

UPDATE "GLOBAL_TAG"
SET
  "genderLabel" = 'Tipo',
  "birthDateLabel" = 'Inicio',
  "deathDateLabel" = 'Fim',
  "bioLabel" = 'Contexto',
  "maleLabel" = 'Pessoa',
  "femaleLabel" = 'Evento',
  "otherLabel" = 'Outro'
WHERE "slug" = 'ww2';

UPDATE "GLOBAL_TAG"
SET
  "genderLabel" = 'Tipo',
  "birthDateLabel" = 'Fundacao',
  "deathDateLabel" = 'Encerramento',
  "bioLabel" = 'Descricao',
  "maleLabel" = 'Local',
  "femaleLabel" = 'Regiao',
  "otherLabel" = 'Outro'
WHERE "slug" = 'place';

UPDATE "GLOBAL_TAG"
SET
  "genderLabel" = 'Tipo',
  "birthDateLabel" = 'Data',
  "deathDateLabel" = 'Fim de validade',
  "bioLabel" = 'Resumo',
  "maleLabel" = 'Registro',
  "femaleLabel" = 'Imagem',
  "otherLabel" = 'Outro'
WHERE "slug" = 'document';
