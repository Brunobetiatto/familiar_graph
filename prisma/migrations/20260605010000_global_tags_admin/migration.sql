CREATE TABLE "GLOBAL_TAG" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "background" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "border" TEXT NOT NULL,
  "primary" TEXT NOT NULL,
  "secondary" TEXT NOT NULL,
  "muted" TEXT NOT NULL,
  "node" TEXT NOT NULL,
  "nodeSelected" TEXT NOT NULL,
  "edge" TEXT NOT NULL,
  "edgeSelected" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GLOBAL_TAG_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GLOBAL_TAG_slug_key" ON "GLOBAL_TAG"("slug");

INSERT INTO "GLOBAL_TAG" (
  "id", "slug", "label", "description", "background", "surface", "border",
  "primary", "secondary", "muted", "node", "nodeSelected", "edge", "edgeSelected", "updatedAt"
) VALUES
  (
    '00000000-0000-4000-8000-000000000001', 'person', 'Person', 'Pessoas e relacoes familiares ou sociais.',
    '#0f0d0b', '#181410', '#3a3020', '#c49a2a', '#f0e6d3', '#8a7856',
    '#181410', '#221e15', '#8a7856', '#b28a35', CURRENT_TIMESTAMP
  ),
  (
    '00000000-0000-4000-8000-000000000002', 'ww2', 'WW2', 'Eventos, unidades, locais e pessoas ligados a Segunda Guerra Mundial.',
    '#0c1110', '#151b16', '#334232', '#a6b06a', '#edf1dc', '#818a66',
    '#151b16', '#202815', '#7d8b62', '#b9c979', CURRENT_TIMESTAMP
  ),
  (
    '00000000-0000-4000-8000-000000000003', 'place', 'Place', 'Cidades, regioes, propriedades e outros pontos geograficos.',
    '#0b1013', '#111a1f', '#28424a', '#5fb5c8', '#e7f4f7', '#73949c',
    '#111a1f', '#152733', '#6d9aa4', '#6bd0e5', CURRENT_TIMESTAMP
  ),
  (
    '00000000-0000-4000-8000-000000000004', 'document', 'Document', 'Arquivos, registros, cartas, fotos e fontes historicas.',
    '#11100d', '#1b1913', '#413826', '#d0b05f', '#f5eddb', '#978966',
    '#1b1913', '#27220f', '#9b875a', '#d5b85f', CURRENT_TIMESTAMP
  );
