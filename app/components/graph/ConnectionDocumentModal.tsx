'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import RichTextViewer from '@/app/components/RichTextViewer';
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
};

export default function ConnectionDocumentModal({ connection, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragPointerIdRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!connection) return;

    modalRef.current?.focus({ preventScroll: true });
  }, [connection]);

  useEffect(() => {
    if (connection) return;

    setDragOffset(0);
    setIsDragging(false);
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

        <div className={styles.body}>
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
        </div>
      </div>
    </div>
  );
}
