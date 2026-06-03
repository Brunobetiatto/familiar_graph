'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DirectNodeModal from './components/DirectNodeModal'; // 1. IMPORT AQUI NO TOPO

type RequestConnection = {
  id: string;
  relation: string;
  newNodeIsFrom: boolean;
  description: string | null;
  globalNode: { name: string };
};

type NodeRequest = {
  id: string;
  nodeName: string;
  nodeBirthDate: string | null;
  nodeDeathDate: string | null;
  nodeGender: string | null;
  nodeBio: string | null;
  userNote: string | null;
  requester: { name: string; email: string };
  connections: RequestConnection[];
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<NodeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // 2. ESTADO DO MODAL AQUI (Dentro da função principal)
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch('/api/node-requests');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('Falha ao buscar requisições');
      
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAction(requestId: string, action: 'approve' | 'reject') {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));

    try {
      const endpoint = `/api/node-requests/${action}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) throw new Error(`Erro ao ${action}`);
    } catch (err) {
      console.error(err);
      fetchRequests();
    }
  }

  if (isLoading) {
    return <div style={{ color: '#c49a2a', padding: 40, background: '#0f0d0b', height: '100vh' }}>Carregando painel...</div>;
  }

  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR');
  };

  const formatGender = (value: string | null) => {
    if (!value) return null;
    if (value === 'MALE') return 'Masculino';
    if (value === 'FEMALE') return 'Feminino';
    if (value === 'OTHER') return 'Outro';
    return value;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0d0b', padding: '40px 20px', fontFamily: '"DM Serif Display", Georgia, serif' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ color: '#c49a2a', margin: 0, fontSize: 32 }}>Painel do Administrador</h1>
            <p style={{ color: '#8a7856', margin: '8px 0 0', fontFamily: 'sans-serif' }}>
              Gerencie as solicitações pendentes para o Grafo Global.
            </p>
          </div>
          
          {/* Botões do Cabeçalho corrigidos (sem duplicação) */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
                onClick={() => setIsDirectModalOpen(true)}
                style={{ padding: '10px 16px', background: '#c49a2a', color: '#0f0d0b', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
            >
                + Criar Nó Direto
            </button>
            <button 
                onClick={() => router.push('/global-graph')}
                style={{ padding: '10px 16px', background: '#181410', color: '#c49a2a', border: '1px solid #3a3020', borderRadius: 8, cursor: 'pointer' }}
            >
                Voltar ao Grafo
            </button>
          </div>
        </div>
        

        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed #3a3020', borderRadius: 12 }}>
            <p style={{ color: '#5a4e38', fontSize: 18 }}>Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {requests.map((req) => {
              const primaryConnection = req.connections[0];
              const hasConnections = req.connections.length > 0;
              const summary = hasConnections
                ? req.connections.length === 1
                  ? `Conectar a ${primaryConnection.globalNode.name} como ${primaryConnection.relation}`
                  : `Conectar a ${primaryConnection.globalNode.name} e mais ${req.connections.length - 1}`
                : 'Sem conexoes';
              const isExpanded = expandedRequestId === req.id;
              
              return (
                <div key={req.id} style={{ background: '#111009', border: '1px solid #3a3020', borderRadius: 12, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ color: '#f0e6d3', margin: '0 0 8px 0', fontSize: 22 }}>
                        {req.nodeName}
                      </h2>
                      <p style={{ color: '#c8b898', margin: 0, fontSize: 14, fontFamily: 'sans-serif' }}>
                        {summary}
                      </p>
                      
                      {req.nodeBio && (
                        <p style={{ color: '#8a7856', marginTop: 12, fontSize: 13, fontStyle: 'italic', fontFamily: 'sans-serif' }}>
                          "{req.nodeBio}"
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', fontFamily: 'sans-serif', fontSize: 12, minWidth: 0 }}>
                      <span style={{ color: '#5a4e38', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitado por</span>
                      <p style={{ color: '#a89878', margin: '4px 0' }}>{req.requester.name || req.requester.email}</p>
                    </div>
                  </div>

                  {req.userNote && (
                    <div style={{ background: '#1a1611', padding: 12, borderRadius: 6, marginTop: 16, borderLeft: '3px solid #c49a2a' }}>
                      <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nota do Usuário</span>
                      <p style={{ color: '#f0e6d3', margin: 0, fontSize: 13, fontFamily: 'sans-serif' }}>{req.userNote}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                      style={{
                        padding: '8px 12px',
                        background: '#181410',
                        color: '#c49a2a',
                        border: '1px solid #3a3020',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>

                    <button 
                      onClick={() => handleAction(req.id, 'reject')}
                      style={{ padding: '8px 16px', background: 'transparent', color: '#ff6b6b', border: '1px solid #ff6b6b40', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Recusar
                    </button>
                    <button 
                      onClick={() => handleAction(req.id, 'approve')}
                      style={{ padding: '8px 16px', background: '#c49a2a', color: '#0f0d0b', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Aprovar
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 20, background: '#181410', borderRadius: 8, border: '1px solid #2a2218', padding: 16 }}>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Genero</span>
                          <p style={{ color: '#c8b898', margin: '4px 0 0', fontFamily: 'sans-serif' }}>
                            {formatGender(req.nodeGender) || 'Nao informado'}
                          </p>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Nascimento</span>
                          <p style={{ color: '#c8b898', margin: '4px 0 0', fontFamily: 'sans-serif' }}>
                            {formatDate(req.nodeBirthDate) || 'Nao informado'}
                          </p>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Falecimento</span>
                          <p style={{ color: '#c8b898', margin: '4px 0 0', fontFamily: 'sans-serif' }}>
                            {formatDate(req.nodeDeathDate) || 'Nao informado'}
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Biografia</span>
                        <p style={{ color: '#c8b898', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                          {req.nodeBio || 'Nao informado'}
                        </p>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Nota do usuario</span>
                        <p style={{ color: '#c8b898', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                          {req.userNote || 'Sem nota'}
                        </p>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Conexoes solicitadas</span>
                        {req.connections.length === 0 ? (
                          <p style={{ color: '#5a4e38', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                            Nenhuma conexao solicitada.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {req.connections.map((connection) => (
                              <div
                                key={connection.id}
                                style={{
                                  background: '#111009',
                                  borderRadius: 6,
                                  border: '1px solid #2a2218',
                                  padding: '10px 12px',
                                  fontFamily: 'sans-serif',
                                  fontSize: 13,
                                  color: '#c8b898',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connection.globalNode.name}</span>
                                  <span style={{ color: '#c49a2a' }}>{connection.relation}</span>
                                  <span style={{ color: '#8a7856', fontSize: 12 }}>
                                    {connection.newNodeIsFrom ? 'Novo no -> alvo' : 'Alvo -> novo no'}
                                  </span>
                                </div>
                                {connection.description && (
                                  <p style={{ color: '#9a8a6a', margin: '8px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                                    {connection.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 3. COMPONENTE RENDERIZADO AQUI NO FINAL DO CONTAINER PRINCIPAL */}
        <DirectNodeModal
          isOpen={isDirectModalOpen}
          onClose={() => setIsDirectModalOpen(false)}
          onSuccess={() => {
            alert('Nó inserido com sucesso!');
          }}
        />

      </div>
    </div>
  );
}
