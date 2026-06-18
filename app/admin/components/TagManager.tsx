'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import Sortable from 'sortablejs';
import {
  DEFAULT_GLOBAL_TAG_SLUG,
  OFFICIAL_GLOBAL_TAGS,
  normalizeGenderOptionKey,
  normalizeGlobalTagGenderOptions,
  slugifyGlobalTag,
  type GlobalTag,
  type GlobalTagFieldLabels,
  type GlobalTagGenderOption,
  type GlobalTagTheme,
} from '@/lib/global-tags';
import {
  normalizeRelationKey,
  normalizeTagRelations,
  type GlobalTagRelation,
} from '@/lib/global-relations';
import styles from '../admin.module.css';

type Props = {
  onTagsChange?: (tags: GlobalTag[]) => void;
};

type TagForm = {
  currentSlug?: string;
  slug: string;
  label: string;
  description: string;
  theme: GlobalTagTheme;
  fieldLabels: GlobalTagFieldLabels;
  genderOptions: FormGenderOption[];
  relations: FormRelation[];
};

type FormGenderOption = GlobalTagGenderOption & {
  clientId: string;
};

type FormRelation = GlobalTagRelation & {
  clientId: string;
};

const COLOR_FIELDS: Array<{ key: keyof GlobalTagTheme; label: string }> = [
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'border', label: 'Borda' },
  { key: 'primary', label: 'Primaria' },
  { key: 'secondary', label: 'Texto' },
  { key: 'muted', label: 'Texto suave' },
  { key: 'node', label: 'No' },
  { key: 'nodeSelected', label: 'No selecionado' },
  { key: 'edge', label: 'Aresta' },
  { key: 'edgeSelected', label: 'Aresta selecionada' },
];

let rowIdCounter = 0;

function createRowId(prefix: string): string {
  rowIdCounter += 1;
  return `${prefix}-${rowIdCounter}`;
}

function reorderByClientIds<T extends { clientId: string }>(items: T[], clientIds: string[]): T[] {
  const itemById = new Map(items.map((item) => [item.clientId, item]));
  const orderedItems = clientIds
    .map((clientId) => itemById.get(clientId))
    .filter((item): item is T => Boolean(item));

  if (orderedItems.length !== items.length) return items;

  return orderedItems;
}

function readSortableClientIds(element: HTMLDivElement | null): string[] {
  if (!element) return [];

  return Array.from(element.children)
    .map((child) => (child as HTMLElement).dataset.rowId)
    .filter((clientId): clientId is string => Boolean(clientId));
}

function createFormFromTag(tag: GlobalTag): TagForm {
  return {
    currentSlug: tag.slug,
    slug: tag.slug,
    label: tag.label,
    description: tag.description,
    theme: { ...tag.theme },
    fieldLabels: { ...tag.fieldLabels },
    genderOptions: tag.genderOptions.map((option) => ({
      ...option,
      clientId: createRowId('gender-option'),
    })),
    relations: tag.relations.map((relation) => ({
      ...relation,
      clientId: createRowId('relation'),
    })),
  };
}

function createBlankForm(): TagForm {
  const base = OFFICIAL_GLOBAL_TAGS[0];

  return {
    slug: '',
    label: '',
    description: '',
    theme: { ...base.theme },
    fieldLabels: { ...base.fieldLabels },
    genderOptions: base.genderOptions.map((option) => ({
      ...option,
      clientId: createRowId('gender-option'),
    })),
    relations: base.relations.map((relation) => ({
      ...relation,
      clientId: createRowId('relation'),
    })),
  };
}

export default function TagManager({ onTagsChange }: Props) {
  const [tags, setTags] = useState<GlobalTag[]>(OFFICIAL_GLOBAL_TAGS);
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_GLOBAL_TAG_SLUG);
  const [form, setForm] = useState<TagForm>(createFormFromTag(OFFICIAL_GLOBAL_TAGS[0]));
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteResult, setDeleteResult] = useState('');
  const genderOptionsListRef = useRef<HTMLDivElement>(null);
  const relationsListRef = useRef<HTMLDivElement>(null);
  const [openPanels, setOpenPanels] = useState({
    fields: false,
    colors: false,
    relations: false,
    danger: false,
  });

  const selectedTag = useMemo(
    () => tags.find((tag) => tag.slug === selectedSlug) ?? tags[0],
    [selectedSlug, tags]
  );

  useEffect(() => {
    void fetchTags();
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !selectedTag) return;
    setForm(createFormFromTag(selectedTag));
    setDeleteConfirm('');
    setDeleteResult('');
  }, [mode, selectedTag]);

  useEffect(() => {
    const createSortable = (
      element: HTMLDivElement | null,
      onReorder: (clientIds: string[]) => void
    ) => {
      if (!element) return null;

      return Sortable.create(element, {
        animation: 150,
        ghostClass: styles.sortableGhost,
        chosenClass: styles.sortableChosen,
        dragClass: styles.sortableDrag,
        handle: `.${styles.dragHandle}`,
        onEnd: () => {
          const clientIds = Array.from(element.children)
            .map((child) => (child as HTMLElement).dataset.rowId)
            .filter((clientId): clientId is string => Boolean(clientId));

          onReorder(clientIds);
        },
      });
    };

    const genderSortable = createSortable(genderOptionsListRef.current, (clientIds) => {
      setForm((current) => ({
        ...current,
        genderOptions: reorderByClientIds(current.genderOptions, clientIds),
      }));
    });
    const relationSortable = createSortable(relationsListRef.current, (clientIds) => {
      setForm((current) => ({
        ...current,
        relations: reorderByClientIds(current.relations, clientIds),
      }));
    });

    return () => {
      genderSortable?.destroy();
      relationSortable?.destroy();
    };
  }, []);

  async function fetchTags() {
    try {
      const res = await fetch('/api/admin/global-tags');
      if (!res.ok) return;
      const data = (await res.json()) as GlobalTag[];
      if (data.length === 0) return;
      setTags(data);
      onTagsChange?.(data);
      setSelectedSlug((current) => (data.some((tag) => tag.slug === current) ? current : data[0].slug));
    } catch (err) {
      console.error('Erro ao buscar tags:', err);
    }
  }

  function updateTheme(key: keyof GlobalTagTheme, value: string) {
    setForm((current) => ({
      ...current,
      theme: {
        ...current.theme,
        [key]: value,
      },
    }));
  }

  function updateFieldLabel(key: keyof GlobalTagFieldLabels, value: string) {
    setForm((current) => ({
      ...current,
      fieldLabels: {
        ...current.fieldLabels,
        [key]: value,
      },
    }));
  }

  function addGenderOption() {
    setForm((current) => ({
      ...current,
      genderOptions: [
        ...current.genderOptions,
        { key: '', label: '', clientId: createRowId('gender-option') },
      ],
    }));
  }

  function updateGenderOption(index: number, field: keyof GlobalTagGenderOption, value: string) {
    setForm((current) => ({
      ...current,
      genderOptions: current.genderOptions.map((option, optionIndex) => {
        if (optionIndex !== index) return option;

        if (field === 'key') {
          return { ...option, key: normalizeGenderOptionKey(value) };
        }

        return {
          ...option,
          label: value,
          key: option.key || normalizeGenderOptionKey(value),
        };
      }),
    }));
  }

  function removeGenderOption(index: number) {
    setForm((current) => {
      const nextOptions = current.genderOptions.filter((_, optionIndex) => optionIndex !== index);

      return {
        ...current,
        genderOptions:
          nextOptions.length > 0
            ? nextOptions
            : [{ key: 'OTHER', label: 'Outro', clientId: createRowId('gender-option') }],
      };
    });
  }

  function addRelation() {
    setForm((current) => ({
      ...current,
      relations: [
        ...current.relations,
        { key: '', label: '', clientId: createRowId('relation') },
      ],
    }));
  }

  function updateRelation(index: number, field: keyof GlobalTagRelation, value: string) {
    setForm((current) => ({
      ...current,
      relations: current.relations.map((relation, relationIndex) => {
        if (relationIndex !== index) return relation;

        if (field === 'key') {
          return { ...relation, key: normalizeRelationKey(value) };
        }

        return {
          ...relation,
          label: value,
          key: relation.key || normalizeRelationKey(value),
        };
      }),
    }));
  }

  function removeRelation(index: number) {
    setForm((current) => {
      const nextRelations = current.relations.filter((_, relationIndex) => relationIndex !== index);

      return {
        ...current,
        relations:
          nextRelations.length > 0
            ? nextRelations
            : [{ key: 'OTHER', label: 'Outro', clientId: createRowId('relation') }],
      };
    });
  }

  function togglePanel(panel: keyof typeof openPanels) {
    setOpenPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const orderedGenderOptions = reorderByClientIds(
        form.genderOptions,
        readSortableClientIds(genderOptionsListRef.current)
      );
      const orderedRelations = reorderByClientIds(
        form.relations,
        readSortableClientIds(relationsListRef.current)
      );
      const payload = {
        currentSlug: form.currentSlug,
        slug: form.slug || slugifyGlobalTag(form.label),
        label: form.label,
        description: form.description,
        theme: form.theme,
        fieldLabels: form.fieldLabels,
        genderOptions: normalizeGlobalTagGenderOptions(orderedGenderOptions),
        relations: normalizeTagRelations(orderedRelations),
      };
      const res = await fetch('/api/admin/global-tags', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar tag.');
      }

      const saved = (await res.json()) as GlobalTag;
      await fetchTags();
      setMode('edit');
      setSelectedSlug(saved.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tag.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTag() {
    if (!selectedTag || mode !== 'edit') return;
    if (selectedTag.slug === DEFAULT_GLOBAL_TAG_SLUG) {
      setError('A tag padrao nao pode ser deletada.');
      return;
    }
    if (deleteConfirm !== selectedTag.slug) {
      setError(`Digite "${selectedTag.slug}" para confirmar a exclusao.`);
      return;
    }

    setIsDeleting(true);
    setError('');
    setDeleteResult('');

    try {
      const res = await fetch('/api/admin/global-tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedTag.slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao deletar tag.');
      }

      await fetchTags();
      setDeleteConfirm('');
      setDeleteResult(
        `Tag deletada: ${data.deletedNodes} nos, ${data.deletedEdges} ligacoes, ${data.deletedImages}/${data.imageUrls} imagens removidas.`
      );
      setMode('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar tag.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className={styles.tagManager} style={{ marginBottom: 28, background: '#111009', border: '1px solid #3a3020', borderRadius: 12, padding: 18 }}>
      <div className={styles.tagManagerHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#f0e6d3', margin: 0, fontSize: 20 }}>Tags do Grafo Global</h2>
          <p style={{ color: '#8a7856', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
            Crie temas e personalize as cores usadas no filtro e no grafo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMode('create');
            setForm(createBlankForm());
          }}
          className={styles.primaryButton}
        >
          Nova tag
        </button>
      </div>

      <div className={styles.tagManagerGrid} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.8fr) minmax(0, 1.4fr)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => {
                setMode('edit');
                setSelectedSlug(tag.slug);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: mode === 'edit' && selectedSlug === tag.slug ? '#1d180f' : '#181410',
                color: '#f0e6d3',
                border: `1px solid ${mode === 'edit' && selectedSlug === tag.slug ? tag.theme.primary : '#2a2218'}`,
                borderRadius: 7,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: tag.theme.primary, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 13 }}>{tag.label}</strong>
                <span style={{ display: 'block', color: '#8a7856', fontSize: 11, fontFamily: 'sans-serif' }}>{tag.slug}</span>
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#181410', border: '1px solid #2a2218', borderRadius: 8, padding: 14 }}>
          <div className={styles.twoColumnForm} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nome">
              <input
                value={form.label}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    label: event.target.value,
                    slug: mode === 'create' ? slugifyGlobalTag(event.target.value) : current.slug,
                  }))
                }
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Slug">
              <input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: slugifyGlobalTag(event.target.value) }))}
                required
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Descricao">
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              style={{ ...inputStyle, minHeight: 62, resize: 'vertical' }}
            />
          </Field>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: `1px solid ${form.theme.border}`, background: form.theme.surface }}>
            <span style={{ color: form.theme.muted, fontSize: 11, textTransform: 'uppercase', fontFamily: 'sans-serif' }}>Preview</span>
            <h3 style={{ color: form.theme.secondary, margin: '4px 0 6px', fontSize: 18 }}>{form.label || 'Nova tag'}</h3>
            <p style={{ color: form.theme.muted, margin: 0, fontFamily: 'sans-serif', fontSize: 12 }}>{form.description || 'Descricao do tema'}</p>
            <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: form.theme.primary }} />
          </div>

          <div className={`${styles.configPanel} ${openPanels.fields ? styles.configPanelOpen : ''}`}>
            <button
              type="button"
              className={styles.configPanelSummary}
              onClick={() => togglePanel('fields')}
              aria-expanded={openPanels.fields}
            >
              <span>Campos do no</span>
              <small>Rotulos por tema</small>
            </button>

            <div className={styles.configPanelBody}>
              <p style={{ color: '#8a7856', margin: '0 0 10px', fontSize: 12, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                Renomeie os campos para este tema. Os dados continuam usando a mesma estrutura no banco,
                mas a interface mostra os nomes abaixo.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                <Field label="Campo de genero/tipo">
                  <input
                    value={form.fieldLabels.gender}
                    onChange={(event) => updateFieldLabel('gender', event.target.value)}
                    style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                  />
                </Field>
                <Field label="Campo de nascimento/inicio">
                  <input
                    value={form.fieldLabels.birthDate}
                    onChange={(event) => updateFieldLabel('birthDate', event.target.value)}
                    style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                  />
                </Field>
                <Field label="Campo de falecimento/fim">
                  <input
                    value={form.fieldLabels.deathDate}
                    onChange={(event) => updateFieldLabel('deathDate', event.target.value)}
                    style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                  />
                </Field>
                <Field label="Campo de biografia">
                  <input
                    value={form.fieldLabels.bio}
                    onChange={(event) => updateFieldLabel('bio', event.target.value)}
                    style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                  />
                </Field>
              </div>

              <div className={styles.relationHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '14px 0 10px' }}>
                <p style={{ color: '#8a7856', margin: 0, fontSize: 12, fontFamily: 'sans-serif' }}>
                  Defina as opcoes disponiveis para este campo.
                </p>
                <button
                  type="button"
                  onClick={addGenderOption}
                  style={{ padding: '8px 10px', background: '#231d16', color: '#f0e6d3', border: '1px solid #3a3020', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                >
                  Adicionar
                </button>
              </div>

              <div ref={genderOptionsListRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.genderOptions.map((option, index) => (
                  <div key={option.clientId} data-row-id={option.clientId} className={styles.relationRow} style={{ display: 'grid', gridTemplateColumns: '28px 0.85fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      className={styles.dragHandle}
                      aria-label="Arrastar opcao"
                    >
                      ||
                    </button>
                    <input
                      value={option.key}
                      onChange={(event) => updateGenderOption(index, 'key', event.target.value)}
                      placeholder="CHAVE_TECNICA"
                      style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                    />
                    <input
                      value={option.label}
                      onChange={(event) => updateGenderOption(index, 'label', event.target.value)}
                      placeholder="Rotulo visivel"
                      style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeGenderOption(index)}
                      style={{ height: 34, padding: '0 10px', background: 'transparent', color: '#ff6b6b', border: '1px solid #4a241e', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${styles.configPanel} ${openPanels.colors ? styles.configPanelOpen : ''}`}>
            <button
              type="button"
              className={styles.configPanelSummary}
              onClick={() => togglePanel('colors')}
              aria-expanded={openPanels.colors}
            >
              <span>Cores do tema</span>
              <small>{COLOR_FIELDS.length} opcoes</small>
            </button>

            <div className={styles.configPanelBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }}>
                {COLOR_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={form.theme[field.key]}
                        onChange={(event) => updateTheme(field.key, event.target.value)}
                        style={{ width: 38, height: 34, padding: 0, border: '1px solid #3a3020', background: 'transparent', borderRadius: 6 }}
                      />
                      <input
                        value={form.theme[field.key]}
                        onChange={(event) => updateTheme(field.key, event.target.value)}
                        style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                      />
                    </div>
                  </Field>
                ))}
              </div>
            </div>
          </div>

          <div className={`${styles.configPanel} ${openPanels.relations ? styles.configPanelOpen : ''}`}>
            <button
              type="button"
              className={styles.configPanelSummary}
              onClick={() => togglePanel('relations')}
              aria-expanded={openPanels.relations}
            >
              <span>Relacoes permitidas</span>
              <small>{form.relations.length} relacoes</small>
            </button>

            <div className={styles.configPanelBody}>
              <div className={styles.relationHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <p style={{ color: '#8a7856', margin: 0, fontSize: 12, fontFamily: 'sans-serif' }}>
                  O usuario so podera escolher estas relacoes ao criar nos deste tema.
                </p>
                <button
                  type="button"
                  onClick={addRelation}
                  style={{ padding: '8px 10px', background: '#231d16', color: '#f0e6d3', border: '1px solid #3a3020', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                >
                  Adicionar
                </button>
              </div>
              <div ref={relationsListRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.relations.map((relation, index) => (
                  <div key={relation.clientId} data-row-id={relation.clientId} className={styles.relationRow} style={{ display: 'grid', gridTemplateColumns: '28px 0.85fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      className={styles.dragHandle}
                      aria-label="Arrastar relacao"
                    >
                      ||
                    </button>
                    <input
                      value={relation.key}
                      onChange={(event) => updateRelation(index, 'key', event.target.value)}
                      placeholder="CHAVE_TECNICA"
                      style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                    />
                    <input
                      value={relation.label}
                      onChange={(event) => updateRelation(index, 'label', event.target.value)}
                      placeholder="Rotulo visivel"
                      style={{ ...inputStyle, padding: '8px 9px', fontSize: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRelation(index)}
                      style={{ height: 34, padding: '0 10px', background: 'transparent', color: '#ff6b6b', border: '1px solid #4a241e', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {mode === 'edit' && selectedTag && (
            <div className={`${styles.configPanel} ${openPanels.danger ? styles.configPanelOpen : ''}`}>
              <button
                type="button"
                className={styles.configPanelSummary}
                onClick={() => togglePanel('danger')}
                aria-expanded={openPanels.danger}
              >
                <span>Zona de risco</span>
                <small>Excluir tag e dados</small>
              </button>

              <div className={styles.configPanelBody}>
                <div
                  style={{
                    background: 'rgba(255, 107, 107, 0.06)',
                    border: '1px solid rgba(255, 107, 107, 0.2)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <p style={{ color: '#f0b3ad', margin: 0, fontSize: 13, fontFamily: 'sans-serif', lineHeight: 1.55 }}>
                    Esta acao deleta a tag <strong>{selectedTag.label}</strong>, todos os nos deste tema,
                    ligacoes ligadas a estes nos, solicitacoes pendentes da tag e tenta remover as imagens
                    relacionadas no Azure.
                  </p>
                  {selectedTag.slug === DEFAULT_GLOBAL_TAG_SLUG ? (
                    <p style={{ color: '#8a7856', margin: '10px 0 0', fontSize: 12, fontFamily: 'sans-serif' }}>
                      A tag padrao nao pode ser deletada.
                    </p>
                  ) : (
                    <>
                      <Field label={`Digite ${selectedTag.slug} para confirmar`}>
                        <input
                          value={deleteConfirm}
                          onChange={(event) => setDeleteConfirm(event.target.value)}
                          placeholder={selectedTag.slug}
                          style={inputStyle}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTag()}
                        disabled={isDeleting || deleteConfirm !== selectedTag.slug}
                        style={{
                          width: '100%',
                          marginTop: 12,
                          padding: '10px 12px',
                          background: deleteConfirm === selectedTag.slug && !isDeleting ? '#7f211b' : '#2a1815',
                          color: deleteConfirm === selectedTag.slug && !isDeleting ? '#ffe5df' : '#8a5c56',
                          border: '1px solid #5a241f',
                          borderRadius: 7,
                          cursor: deleteConfirm === selectedTag.slug && !isDeleting ? 'pointer' : 'not-allowed',
                          fontWeight: 800,
                        }}
                      >
                        {isDeleting ? 'Deletando tag...' : `Deletar ${selectedTag.label}`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p style={{ color: '#ff6b6b', fontSize: 12, fontFamily: 'sans-serif' }}>{error}</p>}
          {deleteResult && <p style={{ color: '#b9d08a', fontSize: 12, fontFamily: 'sans-serif' }}>{deleteResult}</p>}

          <button
            type="submit"
            disabled={isSaving}
            style={{ width: '100%', marginTop: 14, padding: '11px 12px', background: isSaving ? '#3a3020' : '#c49a2a', color: '#0f0d0b', border: 0, borderRadius: 7, cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 700 }}
          >
            {isSaving ? 'Salvando...' : mode === 'create' ? 'Criar tag' : 'Salvar tag'}
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginTop: 10 }}>
      <span style={{ display: 'block', color: '#5a4e38', fontSize: 10, textTransform: 'uppercase', marginBottom: 5, fontFamily: 'sans-serif' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: 6,
  border: '1px solid #3a3020',
  background: '#0f0d0b',
  color: '#f0e6d3',
  fontFamily: 'sans-serif',
  fontSize: 13,
  outline: 'none',
};
