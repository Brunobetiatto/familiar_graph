'use client';

import { useEffect, useRef } from 'react';
import type { PersonNodeData } from './nodes/PersonNode';
import { moveFocusWithin } from '@/lib/keyboard-navigation';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Props = {
  node: (PersonNodeData & { id: string }) | null;
  connections: NodeConnection[];
  selectedEdgeId: string | null;
  onClose: () => void;
  onSelectConnection: (edgeId: string) => void;
  onRequestConnection?: (node: { id: string; name: string }) => void;
};

type NodeConnection = {
  edgeId: string;
  otherNodeName: string;
  directionLabel: string;
  relation: string;
  description: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GENDER_LABEL: Record<string, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
};

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

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NodeDetailPanel({
  node,
  connections,
  selectedEdgeId,
  onClose,
  onSelectConnection,
  onRequestConnection,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node) return;

    window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
  }, [node]);

  const visible = node !== null;
  const selectedConnection = connections.find((connection) => connection.edgeId === selectedEdgeId);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Detalhes do membro"
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
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: 300,
        maxWidth: '100vw',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#111009',
        borderLeft: '1px solid #3a3020',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        fontFamily: '"DM Serif Display", Georgia, serif',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Cabeçalho ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #2a2218',
        }}
      >
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '28px 20px 20px',
              borderBottom: '1px solid #2a2218',
              minHeight: 0,
            }}
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
                {GENDER_LABEL[node.gender]}
              </span>
            )}
          </div>

          {/* ── Campos de informação ── */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {formatDate(node.birthDate) && (
              <InfoRow label="Nascimento" value={formatDate(node.birthDate)!} />
            )}
            {formatDate(node.deathDate) && (
              <InfoRow label="Falecimento" value={formatDate(node.deathDate)!} />
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
                  Biografia
                </p>
                <p
                  style={{
                    color: '#9a8a6a',
                    fontSize: 13,
                    lineHeight: 1.65,
                    margin: 0,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 7,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {node.bio}
                </p>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

            {selectedConnection && (
              <div
                style={{
                  background: '#181410',
                  border: '1px solid #3a3020',
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: 'sans-serif',
                }}
              >
                <p
                  style={{
                    color: '#5a4e38',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    margin: '0 0 8px',
                  }}
                >
                  Descricao completa
                </p>
                <p
                  style={{
                    color: '#c49a2a',
                    fontSize: 12,
                    margin: '0 0 8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedConnection.otherNodeName} · {selectedConnection.relation}
                </p>
                <textarea
                  readOnly
                  value={selectedConnection.description || 'Sem descricao registrada.'}
                  style={{
                    width: '100%',
                    minHeight: 180,
                    maxHeight: 280,
                    padding: '10px 12px',
                    background: '#0f0d0b',
                    border: '1px solid #2a2218',
                    borderRadius: 6,
                    color: '#c8b898',
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: 'sans-serif',
                    resize: 'none',
                    outline: 'none',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    whiteSpace: 'pre-wrap',
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Rodapé ── */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #2a2218' }}>
            <GhostButton
              onClick={() => onRequestConnection?.({ id: node.id, name: node.name })}
              label="Solicitar novo nó →"
            />
          </div>
        </>
      )}
    </div>
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
