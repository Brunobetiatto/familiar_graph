import {
  DEFAULT_GLOBAL_RELATIONS,
  getDefaultRelationsForTag,
  type GlobalTagRelation,
} from '@/lib/global-relations';

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

export type GlobalTagFieldLabels = {
  gender: string;
  birthDate: string;
  deathDate: string;
  bio: string;
};

export type GlobalTagGenderOption = {
  key: string;
  label: string;
};

export type GlobalTag = {
  slug: string;
  label: string;
  description: string;
  theme: GlobalTagTheme;
  fieldLabels: GlobalTagFieldLabels;
  genderOptions: GlobalTagGenderOption[];
  relations: GlobalTagRelation[];
};

export const DEFAULT_GLOBAL_TAG_SLUG = 'person';
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_GLOBAL_FIELD_LABELS: GlobalTagFieldLabels = {
  gender: 'Genero',
  birthDate: 'Nascimento',
  deathDate: 'Falecimento',
  bio: 'Biografia',
};
export const DEFAULT_GLOBAL_GENDER_OPTIONS: GlobalTagGenderOption[] = [
  { key: 'MALE', label: 'Masculino' },
  { key: 'FEMALE', label: 'Feminino' },
  { key: 'OTHER', label: 'Outro' },
];

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
    fieldLabels: DEFAULT_GLOBAL_FIELD_LABELS,
    genderOptions: DEFAULT_GLOBAL_GENDER_OPTIONS,
    relations: DEFAULT_GLOBAL_RELATIONS,
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
    fieldLabels: {
      gender: 'Tipo',
      birthDate: 'Inicio',
      deathDate: 'Fim',
      bio: 'Contexto',
    },
    genderOptions: [
      { key: 'PERSON', label: 'Pessoa' },
      { key: 'EVENT', label: 'Evento' },
      { key: 'OTHER', label: 'Outro' },
    ],
    relations: getDefaultRelationsForTag('ww2'),
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
    fieldLabels: {
      gender: 'Tipo',
      birthDate: 'Fundacao',
      deathDate: 'Encerramento',
      bio: 'Descricao',
    },
    genderOptions: [
      { key: 'PLACE', label: 'Local' },
      { key: 'REGION', label: 'Regiao' },
      { key: 'OTHER', label: 'Outro' },
    ],
    relations: getDefaultRelationsForTag('place'),
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
    fieldLabels: {
      gender: 'Tipo',
      birthDate: 'Data',
      deathDate: 'Fim de validade',
      bio: 'Resumo',
    },
    genderOptions: [
      { key: 'RECORD', label: 'Registro' },
      { key: 'IMAGE', label: 'Imagem' },
      { key: 'OTHER', label: 'Outro' },
    ],
    relations: getDefaultRelationsForTag('document'),
  },
];

const TAG_BY_SLUG = new Map(OFFICIAL_GLOBAL_TAGS.map((tag) => [tag.slug, tag]));

export function getGlobalTag(slug?: string | null): GlobalTag {
  return TAG_BY_SLUG.get(slug ?? '') ?? TAG_BY_SLUG.get(DEFAULT_GLOBAL_TAG_SLUG)!;
}

export function slugifyGlobalTag(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function normalizeGlobalTagSlug(slug?: string | null): string {
  const normalized = slug ? slugifyGlobalTag(slug) : '';
  return normalized || DEFAULT_GLOBAL_TAG_SLUG;
}

export function isOfficialGlobalTag(slug?: string | null): boolean {
  return TAG_BY_SLUG.has(slug ?? '');
}

export function sanitizeGlobalTagTheme(theme: Partial<GlobalTagTheme> = {}): GlobalTagTheme {
  const fallback = getGlobalTag(DEFAULT_GLOBAL_TAG_SLUG).theme;

  return {
    background: sanitizeHex(theme.background, fallback.background),
    surface: sanitizeHex(theme.surface, fallback.surface),
    border: sanitizeHex(theme.border, fallback.border),
    primary: sanitizeHex(theme.primary, fallback.primary),
    secondary: sanitizeHex(theme.secondary, fallback.secondary),
    muted: sanitizeHex(theme.muted, fallback.muted),
    node: sanitizeHex(theme.node, theme.surface || fallback.node),
    nodeSelected: sanitizeHex(theme.nodeSelected, fallback.nodeSelected),
    edge: sanitizeHex(theme.edge, fallback.edge),
    edgeSelected: sanitizeHex(theme.edgeSelected, theme.primary || fallback.edgeSelected),
  };
}

export function sanitizeGlobalTagFieldLabels(
  labels: Partial<GlobalTagFieldLabels> = {}
): GlobalTagFieldLabels {
  return {
    gender: sanitizeLabel(labels.gender, DEFAULT_GLOBAL_FIELD_LABELS.gender),
    birthDate: sanitizeLabel(labels.birthDate, DEFAULT_GLOBAL_FIELD_LABELS.birthDate),
    deathDate: sanitizeLabel(labels.deathDate, DEFAULT_GLOBAL_FIELD_LABELS.deathDate),
    bio: sanitizeLabel(labels.bio, DEFAULT_GLOBAL_FIELD_LABELS.bio),
  };
}

export function normalizeGenderOptionKey(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function normalizeGlobalTagGenderOptions(
  options: Array<Partial<GlobalTagGenderOption>> | Record<string, string> | null | undefined,
  fallback: GlobalTagGenderOption[] = DEFAULT_GLOBAL_GENDER_OPTIONS
): GlobalTagGenderOption[] {
  const source = Array.isArray(options)
    ? options
    : options && typeof options === 'object'
      ? Object.entries(options).map(([key, label]) => ({ key, label }))
      : [];
  const normalized: GlobalTagGenderOption[] = [];
  const seen = new Set<string>();

  for (const option of source) {
    const label = sanitizeLabel(option.label, '');
    const key = normalizeGenderOptionKey(option.key || label);

    if (!key || !label || seen.has(key)) continue;

    normalized.push({ key, label });
    seen.add(key);
  }

  return normalized.length > 0
    ? normalized
    : fallback.map((option) => ({ ...option }));
}

export function findGenderOptionLabel(
  options: GlobalTagGenderOption[] | undefined,
  value?: string | null
): string | null {
  if (!value) return null;

  return options?.find((option) => option.key === value)?.label ?? value;
}

function sanitizeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function sanitizeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, 40) : fallback;
}
