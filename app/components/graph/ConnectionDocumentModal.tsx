'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import RichTextViewer from '@/app/components/RichTextViewer';
import RichTextEditor from '@/app/components/RichTextEditor';
import styles from './ConnectionDocumentModal.module.css';

export type ConnectionDocument = {
  edgeId: string;
  otherNodeName: string;
  directionLabel: string;
  relation: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

type Props = {
  connection: ConnectionDocument | null;
  onClose: () => void;
  canEdit?: boolean;
  citationTagSlug?: string;
  onUpdateConnection?: (edgeId: string, data: ConnectionEditData) => Promise<void>;
};

export type ConnectionEditData = {
  relation: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

function createConnectionEditDraft(connection: ConnectionDocument): ConnectionEditData {
  return {
    relation: connection.relation,
    description: connection.description ?? '',
    documentTitle: connection.documentTitle ?? '',
    documentContent: connection.documentContent ?? '',
    documentImageUrl: connection.documentImageUrl ?? '',
  };
}

export default function ConnectionDocumentModal({
  connection,
  onClose,
  canEdit = false,
  citationTagSlug = 'person',
  onUpdateConnection,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragPointerIdRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ConnectionEditData | null>(null);
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!connection) return;

    setIsEditing(false);
    setEditDraft(createConnectionEditDraft(connection));
    setEditError('');
    modalRef.current?.focus({ preventScroll: true });
  }, [connection]);

  useEffect(() => {
    if (connection) return;

    setDragOffset(0);
    setIsDragging(false);
    setIsEditing(false);
    setEditDraft(null);
    setEditError('');
    dragPointerIdRef.current = null;
  }, [connection]);

  if (!connection) return null;

  const hasDocument =
    connection.documentTitle ||
    connection.documentContent ||
    connection.documentImageUrl ||
    connection.description;

  function startModalDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragStartYRef.current = event.clientY;
    dragPointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveModalDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== event.pointerId) return;

    const offset = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(offset);
  }

  function finishModalDrag(event: PointerEvent<HTMLDivElement>) {
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

  async function handleSaveConnection() {
    if (!connection || !editDraft || !onUpdateConnection) return;

    setIsSaving(true);
    setEditError('');

    try {
      await onUpdateConnection(connection.edgeId, {
        relation: editDraft.relation.trim(),
        description: editDraft.description?.trim() || null,
        documentTitle: editDraft.documentTitle?.trim() || null,
        documentContent: editDraft.documentContent?.trim() || null,
        documentImageUrl: editDraft.documentImageUrl?.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar a ligacao.';
      setEditError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.surface}
        ref={modalRef}
        role="dialog"
        aria-label="Documento da ligação"
        tabIndex={0}
        data-dragging={isDragging ? 'true' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        style={
          {
            '--modal-drag-y': `${dragOffset}px`,
          } as CSSProperties
        }
      >
        <div
          className={styles.header}
          onPointerDown={startModalDrag}
          onPointerMove={moveModalDrag}
          onPointerUp={finishModalDrag}
          onPointerCancel={finishModalDrag}
        >
          <div className={styles.headerContent}>
            <div className={styles.mobileHandle} aria-hidden="true" />
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{connection.relation}</span>
              <span className={styles.metaPill}>{connection.directionLabel}</span>
            </div>
            <h2 className={styles.title}>
              {connection.documentTitle || 'Documento da ligacao'}
            </h2>
            <p className={styles.subtitle}>{connection.otherNodeName}</p>
          </div>
          <div className={styles.headerActions}>
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setEditDraft(createConnectionEditDraft(connection));
                  setIsEditing(true);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className={styles.editButton}
              >
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Fechar documento"
              className={styles.closeButton}
            >
              x
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {isEditing && editDraft ? (
            <div className={styles.editForm}>
              <label className={styles.editField}>
                <span>Relacao</span>
                <input
                  value={editDraft.relation}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, relation: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editField}>
                <span>Titulo do documento</span>
                <input
                  value={editDraft.documentTitle ?? ''}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, documentTitle: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editField}>
                <span>Imagem principal</span>
                <input
                  value={editDraft.documentImageUrl ?? ''}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, documentImageUrl: event.target.value } : current
                    )
                  }
                  placeholder="https://..."
                />
              </label>

              <label className={styles.editField}>
                <span>Resumo</span>
                <textarea
                  value={editDraft.description ?? ''}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  rows={4}
                />
              </label>

              <div className={styles.editField}>
                <span>Documento</span>
                <RichTextEditor
                  value={editDraft.documentContent ?? ''}
                  onChange={(value) =>
                    setEditDraft((current) =>
                      current ? { ...current, documentContent: value } : current
                    )
                  }
                  citationTagSlug={citationTagSlug}
                  allowImages={false}
                  minHeight={260}
                />
              </div>

              {editError && <p className={styles.editError}>{editError}</p>}

              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.editCancelButton}
                  onClick={() => {
                    setEditDraft(createConnectionEditDraft(connection));
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
                  onClick={() => void handleSaveConnection()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {connection.documentImageUrl && (
                <img
                  src={connection.documentImageUrl}
                  alt=""
                  className={styles.image}
                />
              )}

              {connection.description && (
                <p className={styles.description}>
                  {connection.description}
                </p>
              )}

              {connection.documentContent ? (
                <div className={styles.richText}>
                  <RichTextViewer value={connection.documentContent} />
                </div>
              ) : (
                !hasDocument && (
                  <p className={styles.emptyMessage}>
                    Nenhum documento registrado para esta ligacao.
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
