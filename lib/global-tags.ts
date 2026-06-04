export type GlobalTagTheme = {
  background: string;
  surface: string;
  border: string;
  primary: string;
  secondary: string;
  muted: string;
  node: string;
  nodeSelected: string;
  edge: string;
  edgeSelected: string;
};

export type GlobalTag = {
  slug: string;
  label: string;
  description: string;
  theme: GlobalTagTheme;
};

export const DEFAULT_GLOBAL_TAG_SLUG = 'person';

export const OFFICIAL_GLOBAL_TAGS: GlobalTag[] = [
  {
    slug: 'person',
    label: 'Person',
    description: 'Pessoas e relacoes familiares ou sociais.',
    theme: {
      background: '#0f0d0b',
      surface: '#181410',
      border: '#3a3020',
      primary: '#c49a2a',
      secondary: '#f0e6d3',
      muted: '#8a7856',
      node: '#181410',
      nodeSelected: '#221e15',
      edge: '#8a7856',
      edgeSelected: '#b28a35',
    },
  },
  {
    slug: 'ww2',
    label: 'WW2',
    description: 'Eventos, unidades, locais e pessoas ligados a Segunda Guerra Mundial.',
    theme: {
      background: '#0c1110',
      surface: '#151b16',
      border: '#334232',
      primary: '#a6b06a',
      secondary: '#edf1dc',
      muted: '#818a66',
      node: '#151b16',
      nodeSelected: '#202815',
      edge: '#7d8b62',
      edgeSelected: '#b9c979',
    },
  },
  {
    slug: 'place',
    label: 'Place',
    description: 'Cidades, regioes, propriedades e outros pontos geograficos.',
    theme: {
      background: '#0b1013',
      surface: '#111a1f',
      border: '#28424a',
      primary: '#5fb5c8',
      secondary: '#e7f4f7',
      muted: '#73949c',
      node: '#111a1f',
      nodeSelected: '#152733',
      edge: '#6d9aa4',
      edgeSelected: '#6bd0e5',
    },
  },
  {
    slug: 'document',
    label: 'Document',
    description: 'Arquivos, registros, cartas, fotos e fontes historicas.',
    theme: {
      background: '#11100d',
      surface: '#1b1913',
      border: '#413826',
      primary: '#d0b05f',
      secondary: '#f5eddb',
      muted: '#978966',
      node: '#1b1913',
      nodeSelected: '#27220f',
      edge: '#9b875a',
      edgeSelected: '#d5b85f',
    },
  },
];

const TAG_BY_SLUG = new Map(OFFICIAL_GLOBAL_TAGS.map((tag) => [tag.slug, tag]));

export function getGlobalTag(slug?: string | null): GlobalTag {
  return TAG_BY_SLUG.get(slug ?? '') ?? TAG_BY_SLUG.get(DEFAULT_GLOBAL_TAG_SLUG)!;
}

export function normalizeGlobalTagSlug(slug?: string | null): string {
  return getGlobalTag(slug).slug;
}

export function isOfficialGlobalTag(slug?: string | null): boolean {
  return TAG_BY_SLUG.has(slug ?? '');
}
