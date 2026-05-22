'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RequestConnection = {
  id: string;
  relation: string;
  newNodeIsFrom: boolean;
  globalNode: { name: string };
};

type NodeRequest = {
  id: string;
  nodeName: string;
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

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch('/api/node-requests');
      if (res.status === 401 || res.status === 403) {
        // Se não for admin, chuta de volta para o login ou para o grafo
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
    // Remove o item da tela imediatamente (Optimistic UI)
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
      // Em caso de erro, recarrega a lista do banco
      fetchRequests();
    }
  }

  if (isLoading) {
    return <div style={{ color: '#c49a2a', padding: 40, background: '#0f0d0b', height: '100vh' }}>Carregando painel...</div>;
  }

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
          <button 
            onClick={() => router.push('/global-graph')}
            style={{ padding: '10px 16px', background: '#181410', color: '#c49a2a', border: '1px solid #3a3020', borderRadius: 8, cursor: 'pointer' }}
          >
            Voltar ao Grafo
          </button>
        </div>

        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed #3a3020', borderRadius: 12 }}>
            <p style={{ color: '#5a4e38', fontSize: 18 }}>Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {requests.map((req) => {
              const conn = req.connections[0]; // Pega a primeira conexão
              
              return (
                <div key={req.id} style={{ background: '#111009', border: '1px solid #3a3020', borderRadius: 12, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    
                    {/* Informações do Nó e Relação */}
                    <div>
                      <h2 style={{ color: '#f0e6d3', margin: '0 0 8px 0', fontSize: 22 }}>
                        {req.nodeName}
                      </h2>
                      <p style={{ color: '#c8b898', margin: 0, fontSize: 14, fontFamily: 'sans-serif' }}>
                        Conectar a <strong style={{ color: '#c49a2a' }}>{conn?.globalNode?.name}</strong> como <strong style={{ color: '#c49a2a' }}>{conn?.relation}</strong>
                      </p>
                      
                      {req.nodeBio && (
                        <p style={{ color: '#8a7856', marginTop: 12, fontSize: 13, fontStyle: 'italic', fontFamily: 'sans-serif' }}>
                          "{req.nodeBio}"
                        </p>
                      )}
                    </div>

                    {/* Informações de quem solicitou */}
                    <div style={{ textAlign: 'right', fontFamily: 'sans-serif', fontSize: 12 }}>
                      <span style={{ color: '#5a4e38', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitado por</span>
                      <p style={{ color: '#a89878', margin: '4px 0' }}>{req.requester.name || req.requester.email}</p>
                    </div>
                  </div>

                  {/* Nota do Usuário para o Admin */}
                  {req.userNote && (
                    <div style={{ background: '#1a1611', padding: 12, borderRadius: 6, marginTop: 16, borderLeft: '3px solid #c49a2a' }}>
                      <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nota do Usuário</span>
                      <p style={{ color: '#f0e6d3', margin: 0, fontSize: 13, fontFamily: 'sans-serif' }}>{req.userNote}</p>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}