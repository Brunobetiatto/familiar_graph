'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { PersonNodeData } from './nodes/PersonNode';
import { moveFocusWithin } from '@/lib/keyboard-navigation';
import { findGenderOptionLabel } from '@/lib/global-tags';
import RichTextViewer from '@/app/components/RichTextViewer';
import RichTextEditor from '@/app/components/RichTextEditor';
import styles from './NodeDetailPanel.module.css';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Props = {
  node: (PersonNodeData & { id: string }) | null;
  connections: NodeConnection[];
  selectedEdgeId: string | null;
  onClose: () => void;
  onSelectConnection: (edgeId: string) => void;
  onRequestConnection?: (node: { id: string; name: string }) => void;
  canEdit?: boolean;
  onUpdateNode?: (nodeId: string, data: NodeEditData) => Promise<void>;
};

type NodeConnection = {
  edgeId: string;
  otherNodeName: string;
  directionLabel: string;
  relation: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

export type NodeEditData = {
  name: string;
  gender: PersonNodeData['gender'];
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  photoUrl: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function createNodeEditDraft(node: PersonNodeData & { id: string }): NodeEditData {
  return {
    name: node.name,
    gender: node.gender,
    birthDate: toDateInputValue(node.birthDate) || null,
    deathDate: toDateInputValue(node.deathDate) || null,
    bio: node.bio ?? '',
    photoUrl: node.photoUrl ?? '',
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NodeDetailPanel({
  node,
  connections,
  selectedEdgeId,
  onClose,
  onSelectConnection,
  onRequestConnection,
  canEdit = false,
  onUpdateNode,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragPointerIdRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<NodeEditData | null>(null);
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!node) return;

    setIsEditing(false);
    setEditDraft(createNodeEditDraft(node));
    setEditError('');

    window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
  }, [node]);

  useEffect(() => {
    if (node) return;

    setDragOffset(0);
    setIsDragging(false);
    setIsEditing(false);
    setEditDraft(null);
    setEditError('');
    dragPointerIdRef.current = null;
  }, [node]);

  const visible = node !== null;
  const fieldLabels = node?.fieldLabels;
  const genderOptions = node?.genderOptions ?? [];
  const genderLabel = findGenderOptionLabel(genderOptions, node?.gender);
  const draftGenderMissing =
    Boolean(editDraft?.gender) &&
    !genderOptions.some((option) => option.key === editDraft?.gender);

  function startPanelDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragStartYRef.current = event.clientY;
    dragPointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePanelDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== event.pointerId) return;

    const offset = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(offset);
  }

  function finishPanelDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== event.pointerId) return;

    const shouldClose = dragOffset > 92;
    dragPointerIdRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (shouldClose) {
      onClose();
      return;
    }

    setDragOffset(0);
  }

  async function handleSaveNode() {
    if (!node || !editDraft || !onUpdateNode) return;

    const name = editDraft.name.trim();
    if (!name) {
      setEditError('O nome do no e obrigatorio.');
      return;
    }

    setIsSaving(true);
    setEditError('');

    try {
      await onUpdateNode(node.id, {
        ...editDraft,
        name,
        birthDate: editDraft.birthDate || null,
        deathDate: editDraft.deathDate || null,
        bio: editDraft.bio?.trim() || null,
        photoUrl: editDraft.photoUrl?.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o no.';
      setEditError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${visible ? styles.backdropVisible : ''}`}
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Detalhes do membro"
        className={`${styles.panel} ${visible ? styles.panelVisible : ''}`}
        data-dragging={isDragging ? 'true' : undefined}
        tabIndex={node ? 0 : -1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
            return;
          }

          if (!panelRef.current) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocusWithin(panelRef.current, 1);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocusWithin(panelRef.current, -1);
          }
        }}
        style={
          {
            '--panel-drag-y': `${dragOffset}px`,
          } as CSSProperties
        }
      >
      {/* ── Cabeçalho ── */}
      <div
        className={styles.header}
        onPointerDown={startPanelDrag}
        onPointerMove={movePanelDrag}
        onPointerUp={finishPanelDrag}
        onPointerCancel={finishPanelDrag}
      >
        <span className={styles.mobileHandle} aria-hidden="true" />
        <span
          style={{
            color: '#5a4e38',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Detalhes
        </span>
        <button
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Fechar painel"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#5a4e38',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#c49a2a')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#5a4e38')}
        >
          ✕
        </button>
      </div>

      {node && (
        <>
          {/* ── Avatar + nome ── */}
          <div
            className={styles.hero}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: node.photoUrl
                  ? `url(${node.photoUrl}) center/cover no-repeat`
                  : '#231d10',
                border: '2px solid #4a3c20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                color: '#c49a2a',
                marginBottom: 14,
                letterSpacing: '0.04em',
              }}
            >
              {!node.photoUrl && getInitials(node.name)}
            </div>

            <h2
              style={{
                color: '#f0e6d3',
                fontSize: 18,
                fontWeight: 600,
                textAlign: 'center',
                lineHeight: 1.3,
                margin: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {node.name}
            </h2>

            {node.gender && (
              <span style={{ color: '#6a5a40', fontSize: 12, marginTop: 6 }}>
                {genderLabel}
              </span>
            )}
            {node.tagLabel && (
              <span
                style={{
                  color: node.tagColor || '#c49a2a',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  marginTop: 8,
                  textTransform: 'uppercase',
                }}
              >
                {node.tagLabel}
              </span>
            )}
          </div>

          {/* ── Campos de informação ── */}
          <div className={styles.content}>
            {isEditing && editDraft ? (
              <div className={styles.editForm}>
                <label className={styles.editField}>
                  <span>Nome</span>
                  <input
                    value={editDraft.name}
                    onChange={(event) =>
                      setEditDraft((current) =>
                        current ? { ...current, name: event.target.value } : current
                      )
                    }
                  />
                </label>

                <label className={styles.editField}>
                  <span>{fieldLabels?.gender ?? 'Genero'}</span>
                  <select
                    value={editDraft.gender ?? ''}
                    onChange={(event) =>
                      setEditDraft((current) =>
                        current
                          ? {
                              ...current,
                              gender: (event.target.value || null) as PersonNodeData['gender'],
                            }
                          : current
                      )
                    }
                  >
                    <option value="">Nao informado</option>
                    {genderOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                    {draftGenderMissing && (
                      <option value={editDraft.gender ?? ''}>{editDraft.gender}</option>
                    )}
                  </select>
                </label>

                <div className={styles.editGrid}>
                  <label className={styles.editField}>
                    <span>{fieldLabels?.birthDate ?? 'Nascimento'}</span>
                    <input
                      type="date"
                      value={editDraft.birthDate ?? ''}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current ? { ...current, birthDate: event.target.value || null } : current
                        )
                      }
                    />
                  </label>

                  <label className={styles.editField}>
                    <span>{fieldLabels?.deathDate ?? 'Falecimento'}</span>
                    <input
                      type="date"
                      value={editDraft.deathDate ?? ''}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current ? { ...current, deathDate: event.target.value || null } : current
                        )
                      }
                    />
                  </label>
                </div>

                <label className={styles.editField}>
                  <span>URL da foto</span>
                  <input
                    value={editDraft.photoUrl ?? ''}
                    onChange={(event) =>
                      setEditDraft((current) =>
                        current ? { ...current, photoUrl: event.target.value } : current
                      )
                    }
                    placeholder="https://..."
                  />
                </label>

                <div className={styles.editField}>
                  <span>{fieldLabels?.bio ?? 'Biografia'}</span>
                  <RichTextEditor
                    value={editDraft.bio ?? ''}
                    onChange={(value) =>
                      setEditDraft((current) => (current ? { ...current, bio: value } : current))
                    }
                    citationTagSlug={node.tagSlug}
                    allowImages={false}
                    minHeight={180}
                  />
                </div>

                {editError && <p className={styles.editError}>{editError}</p>}

                <div className={styles.editActions}>
                  <button
                    type="button"
                    className={styles.editCancelButton}
                    onClick={() => {
                      setEditDraft(createNodeEditDraft(node));
                      setIsEditing(false);
                      setEditError('');
                    }}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.editSaveButton}
                    onClick={() => void handleSaveNode()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : (
            <>
            {formatDate(node.birthDate) && (
              <InfoRow label={fieldLabels?.birthDate ?? 'Nascimento'} value={formatDate(node.birthDate)!} />
            )}
            {formatDate(node.deathDate) && (
              <InfoRow label={fieldLabels?.deathDate ?? 'Falecimento'} value={formatDate(node.deathDate)!} />
            )}
            {node.bio && (
              <div>
                <p
                  style={{
                    color: '#5a4e38',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}
                >
                  {fieldLabels?.bio ?? 'Biografia'}
                </p>
                <div
                  style={{
                    color: '#9a8a6a',
                    fontSize: 13,
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  <RichTextViewer value={node.bio} />
                </div>
              </div>
            )}

            {!node.bio && !node.birthDate && !node.deathDate && connections.length === 0 && (
              <p style={{ color: '#3a3020', fontSize: 13, fontStyle: 'italic' }}>
                Sem informações adicionais.
              </p>
            )}

            <div>
              <p
                style={{
                  color: '#5a4e38',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                }}
              >
                Conexoes
              </p>

              {connections.length === 0 ? (
                <p style={{ color: '#3a3020', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
                  Nenhuma conexao registrada.
                </p>
              ) : (
                <div className={styles.connectionList}>
                  {connections.map((connection) => {
                    const selected = selectedEdgeId === connection.edgeId;

                    return (
                      <button
                        key={connection.edgeId}
                        type="button"
                        data-connection-button="true"
                        onClick={() => onSelectConnection(connection.edgeId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelectConnection(connection.edgeId);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: selected ? '#221b0f' : '#181410',
                          border: selected ? '1px solid #c49a2a' : '1px solid #2a2218',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontFamily: 'sans-serif',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            color: '#f0e6d3',
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {connection.otherNodeName}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            color: '#c49a2a',
                            fontSize: 12,
                            marginTop: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {connection.relation} · {connection.directionLabel}
                        </span>
                        {connection.documentTitle && (
                          <span
                            style={{
                              display: 'block',
                              color: '#d9caa8',
                              fontSize: 12,
                              marginTop: 8,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {connection.documentTitle}
                          </span>
                        )}
                        {connection.description && (
                          <span
                            style={{
                              display: '-webkit-box',
                              color: '#9a8a6a',
                              fontSize: 12,
                              lineHeight: 1.45,
                              marginTop: 8,
                              overflow: 'hidden',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {connection.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </>
            )}
          </div>

          {/* ── Rodapé ── */}
          <div className={styles.footer}>
            {canEdit && !isEditing && (
              <button
                type="button"
                className={styles.adminEditButton}
                onClick={() => {
                  setEditDraft(createNodeEditDraft(node));
                  setIsEditing(true);
                }}
              >
                Editar nó
              </button>
            )}
            <GhostButton
              onClick={() => onRequestConnection?.({ id: node.id, name: node.name })}
              label="Solicitar novo nó →"
            />
          </div>
        </>
      )}
      </div>
    </>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          color: '#5a4e38',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p style={{ color: '#c8b898', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </p>
    </div>
  );
}

function GhostButton({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 16px',
        background: 'transparent',
        border: '1px solid #4a3c20',
        borderRadius: 8,
        color: '#8a7856',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
        fontFamily: 'inherit',
        textAlign: 'center',
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.borderColor = '#c49a2a';
        btn.style.color = '#c49a2a';
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.borderColor = '#4a3c20';
        btn.style.color = '#8a7856';
      }}
    >
      {label}
    </button>
  );
}
