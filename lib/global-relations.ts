export type GlobalTagRelation = {
  key: string;
  label: string;
  sortOrder?: number;
};

export const DEFAULT_GLOBAL_RELATIONS: GlobalTagRelation[] = [
  { key: 'PARENT', label: 'Pai/Mae' },
  { key: 'CHILD', label: 'Filho(a)' },
  { key: 'SPOUSE', label: 'Conjuge' },
  { key: 'SIBLING', label: 'Irmao(a)' },
  { key: 'FRIEND', label: 'Amigo(a)' },
  { key: 'ACQUAINTANCE', label: 'Conhecido(a)' },
  { key: 'ROMANTIC', label: 'Romantico(a)' },
  { key: 'COLLEAGUE', label: 'Colega' },
  { key: 'TEAMMATE', label: 'Companheiro(a) de equipe' },
  { key: 'MENTOR', label: 'Mentor' },
  { key: 'STUDENT', label: 'Estudante' },
  { key: 'PARTNER', label: 'Parceiro(a)' },
  { key: 'OTHER', label: 'Outro' },
];

export const DEFAULT_GLOBAL_RELATIONS_BY_TAG: Record<string, GlobalTagRelation[]> = {
  person: DEFAULT_GLOBAL_RELATIONS,
  ww2: [
    { key: 'SERVED_WITH', label: 'Serviu com' },
    { key: 'COMMANDED', label: 'Comandou' },
    { key: 'FOUGHT_AT', label: 'Lutou em' },
    { key: 'ALLY_OF', label: 'Aliado de' },
    { key: 'OPPOSED', label: 'Opositor de' },
    { key: 'DOCUMENTED_BY', label: 'Documentado por' },
    { key: 'OTHER', label: 'Outro' },
  ],
  place: [
    { key: 'BORN_IN', label: 'Nasceu em' },
    { key: 'LIVED_IN', label: 'Viveu em' },
    { key: 'WORKED_IN', label: 'Trabalhou em' },
    { key: 'LOCATED_IN', label: 'Localizado em' },
    { key: 'VISITED', label: 'Visitou' },
    { key: 'OTHER', label: 'Outro' },
  ],
  document: [
    { key: 'MENTIONS', label: 'Menciona' },
    { key: 'AUTHORED_BY', label: 'Autoria de' },
    { key: 'EVIDENCE_FOR', label: 'Evidencia' },
    { key: 'ARCHIVED_AT', label: 'Arquivado em' },
    { key: 'RELATED_TO', label: 'Relacionado a' },
    { key: 'OTHER', label: 'Outro' },
  ],
};

export function getDefaultRelationsForTag(tagSlug?: string | null): GlobalTagRelation[] {
  return DEFAULT_GLOBAL_RELATIONS_BY_TAG[tagSlug ?? ''] ?? DEFAULT_GLOBAL_RELATIONS;
}

export function normalizeRelationKey(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function normalizeTagRelations(
  relations?: Array<Partial<GlobalTagRelation>> | null,
  fallback: GlobalTagRelation[] = DEFAULT_GLOBAL_RELATIONS
): GlobalTagRelation[] {
  const source = relations && relations.length > 0 ? relations : fallback;
  const seen = new Set<string>();
  const normalized: GlobalTagRelation[] = [];

  for (const relation of source) {
    const label = relation.label?.trim() ?? '';
    const key = normalizeRelationKey(relation.key || label);

    if (!key || !label || seen.has(key)) continue;

    seen.add(key);
    normalized.push({
      key,
      label,
      sortOrder: typeof relation.sortOrder === 'number' ? relation.sortOrder : undefined,
    });
  }

  return normalized.length > 0 ? normalized : fallback;
}

export function findRelationLabel(relations: GlobalTagRelation[], relationKey: string): string {
  return relations.find((relation) => relation.key === relationKey)?.label ?? relationKey;
}
