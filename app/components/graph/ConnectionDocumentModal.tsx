'use client';

import { useEffect, useRef } from 'react';
import RichTextViewer from '@/app/components/RichTextViewer';

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

  useEffect(() => {
    if (!connection) return;

    modalRef.current?.focus();
  }, [connection]);

  if (!connection) return null;

  const hasDocument =
    connection.documentTitle ||
    connection.documentContent ||
    connection.documentImageUrl ||
    connection.description;

  return (
    <div
      className="connection-document-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(7, 6, 5, 0.72)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="connection-document-surface"
        ref={modalRef}
        role="dialog"
        aria-label="Documento da ligação"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'min(760px, calc(100vh - 48px))',
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRadius: 10,
          border: '1px solid #3a3020',
          background: '#111009',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
          fontFamily: '"DM Serif Display", Georgia, serif',
          outline: 'none',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 22px',
            borderBottom: '1px solid #2a2218',
            background: 'rgba(17, 16, 9, 0.96)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: '0 0 6px',
                color: '#8a7856',
                fontFamily: 'sans-serif',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {connection.otherNodeName} · {connection.relation}
            </p>
            <h2
              style={{
                margin: 0,
                color: '#f0e6d3',
                fontSize: 24,
                lineHeight: 1.2,
                overflowWrap: 'anywhere',
              }}
            >
              {connection.documentTitle || 'Documento da ligacao'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar documento"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              color: '#8a7856',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {connection.documentImageUrl && (
            <img
              src={connection.documentImageUrl}
              alt=""
              style={{
                width: '100%',
                maxHeight: 300,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #2a2218',
                marginBottom: 18,
                display: 'block',
              }}
            />
          )}

          {connection.description && (
            <p
              style={{
                margin: '0 0 18px',
                padding: '12px 14px',
                borderLeft: '3px solid #b28a35',
                background: '#181410',
                color: '#c8b898',
                fontFamily: 'sans-serif',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {connection.description}
            </p>
          )}

          {connection.documentContent ? (
            <RichTextViewer value={connection.documentContent} />
          ) : (
            !hasDocument && (
              <p style={{ margin: 0, color: '#5a4e38', fontFamily: 'sans-serif', fontSize: 14 }}>
                Nenhum documento registrado para esta ligacao.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
