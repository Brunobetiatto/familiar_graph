'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import RichTextViewer from '@/app/components/RichTextViewer';
import DirectNodeModal from './components/DirectNodeModal'; // 1. IMPORT AQUI NO TOPO
import TagManager from './components/TagManager';
import { findRelationLabel } from '@/lib/global-relations';
import { OFFICIAL_GLOBAL_TAGS, getGlobalTag, type GlobalTag } from '@/lib/global-tags';
import { getPasswordErrors } from '@/lib/auth-security';
import styles from './admin.module.css';

type RequestConnection = {
  id: string;
  relation: string;
  newNodeIsFrom: boolean;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
  globalNode: { name: string };
};

type NodeRequest = {
  id: string;
  nodeName: string;
  nodeBirthDate: string | null;
  nodeDeathDate: string | null;
  nodeGender: string | null;
  nodeBio: string | null;
  nodePhotoUrl: string | null;
  nodeTagSlug: string;
  userNote: string | null;
  requester: { name: string; email: string };
  connections: RequestConnection[];
};

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function AdminDashboard() {
  const [requests, setRequests] = useState<NodeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalTags, setGlobalTags] = useState<GlobalTag[]>(OFFICIAL_GLOBAL_TAGS);
  const router = useRouter();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [isAdminCreatorOpen, setIsAdminCreatorOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [adminCreateError, setAdminCreateError] = useState('');
  const [adminCreateSuccess, setAdminCreateSuccess] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // 2. ESTADO DO MODAL AQUI (Dentro da função principal)
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchTags();
  }, []);

  async function fetchTags() {
    try {
      const res = await fetch('/api/global-tags');
      if (!res.ok) return;
      const tags = (await res.json()) as GlobalTag[];
      if (tags.length > 0) setGlobalTags(tags);
    } catch (err) {
      console.error('Erro ao buscar tags:', err);
    }
  }

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

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminCreateError('');
    setAdminCreateSuccess('');

    if (adminForm.password !== adminForm.confirmPassword) {
      setAdminCreateError('As senhas nao conferem.');
      return;
    }

    const passwordErrors = getPasswordErrors(adminForm.password);
    if (passwordErrors.length > 0) {
      setAdminCreateError(passwordErrors.join(' '));
      return;
    }

    setIsCreatingAdmin(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      });
      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.details) ? ` ${data.details.join(' ')}` : '';
        throw new Error(`${data.error || 'Nao foi possivel criar o admin.'}${details}`);
      }

      setAdminCreateSuccess(`Administrador ${data.user.email} criado.`);
      setAdminForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel criar o admin.';
      setAdminCreateError(message);
    } finally {
      setIsCreatingAdmin(false);
    }
  }

  if (isLoading) {
    return <div className={styles.loading}>Carregando painel...</div>;
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
  const adminPasswordErrors = adminForm.password ? getPasswordErrors(adminForm.password) : [];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Painel do Administrador</h1>
            <p className={styles.subtitle}>
              Gerencie as solicitações pendentes para o Grafo Global.
            </p>
          </div>
          
          {/* Botões do Cabeçalho corrigidos (sem duplicação) */}
          <div className={styles.headerActions}>
            <button 
                onClick={() => setIsDirectModalOpen(true)}
                className={styles.primaryButton}
            >
                + Criar Nó Direto
            </button>
            <button 
                onClick={() => router.push('/global-graph')}
                className={styles.secondaryButton}
            >
                Voltar ao Grafo
            </button>
          </div>
        </div>
        

        <TagManager onTagsChange={setGlobalTags} />

        <section
          className={`${styles.adminCreator} ${
            isAdminCreatorOpen ? styles.adminCreatorOpen : ''
          }`}
        >
          <button
            type="button"
            className={styles.adminCreatorSummary}
            onClick={() => setIsAdminCreatorOpen((current) => !current)}
            aria-expanded={isAdminCreatorOpen}
          >
            <span>Criar administrador</span>
          </button>

          <div className={styles.adminCreatorBody}>
            <form className={styles.adminCreatorForm} onSubmit={handleCreateAdmin}>
              <label className={styles.adminField}>
                <span>Nome</span>
                <input
                  value={adminForm.name}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nome do administrador"
                />
              </label>

              <label className={styles.adminField}>
                <span>E-mail</span>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="admin@exemplo.com"
                  required
                />
              </label>

              <div className={styles.adminCreatorGrid}>
                <label className={styles.adminField}>
                  <span>Senha</span>
                  <input
                    type="password"
                    value={adminForm.password}
                    onChange={(event) =>
                      setAdminForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Senha segura"
                    required
                  />
                </label>

                <label className={styles.adminField}>
                  <span>Confirmar senha</span>
                  <input
                    type="password"
                    value={adminForm.confirmPassword}
                    onChange={(event) =>
                      setAdminForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Repita a senha"
                    required
                  />
                </label>
              </div>

              <div className={styles.passwordHints} data-valid={adminPasswordErrors.length === 0 && adminForm.password ? 'true' : undefined}>
                {adminForm.password ? (
                  adminPasswordErrors.length === 0 ? (
                    <span>Senha atende aos requisitos.</span>
                  ) : (
                    adminPasswordErrors.map((item) => <span key={item}>{item}</span>)
                  )
                ) : (
                  <span>Use 10+ caracteres, letras maiuscula/minuscula, numero e simbolo.</span>
                )}
              </div>

              {adminCreateError && <p className={styles.adminCreateError}>{adminCreateError}</p>}
              {adminCreateSuccess && (
                <p className={styles.adminCreateSuccess}>{adminCreateSuccess}</p>
              )}

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isCreatingAdmin}
              >
                {isCreatingAdmin ? 'Criando...' : 'Criar admin'}
              </button>
            </form>
          </div>
        </section>

        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

        {requests.length === 0 ? (
          <div className={styles.emptyState}>
            <p style={{ color: '#5a4e38', fontSize: 18 }}>Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div className={styles.requestList}>
            {requests.map((req) => {
              const tag =
                globalTags.find((item) => item.slug === req.nodeTagSlug) ??
                getGlobalTag(req.nodeTagSlug);
              const primaryConnection = req.connections[0];
              const relationLabel = primaryConnection
                ? findRelationLabel(tag.relations, primaryConnection.relation)
                : '';
              const hasConnections = req.connections.length > 0;
              const summary = hasConnections
                ? req.connections.length === 1
                  ? `Conectar a ${primaryConnection.globalNode.name} como ${relationLabel}`
                  : `Conectar a ${primaryConnection.globalNode.name} e mais ${req.connections.length - 1}`
                : 'Sem conexoes';
              const isExpanded = expandedRequestId === req.id;
              
              return (
                <div key={req.id} className={styles.requestCard}>
                  <div className={styles.requestTop}>
                    
                    <div className={styles.requestIdentity}>
                      {req.nodePhotoUrl && (
                        <div
                          className={styles.requestPhoto}
                          style={{
                            background: `url(${req.nodePhotoUrl}) center/cover no-repeat`,
                          }}
                        />
                      )}
                      <div className={styles.requestSummary}>
                        <h2>
                          {req.nodeName}
                        </h2>
                        <p className={styles.requestConnectionSummary}>
                          {summary}
                        </p>
                        <span
                          className={styles.requestTag}
                          style={{
                            color: tag.theme.primary,
                          }}
                        >
                          {tag.label}
                        </span>
                        
                        {req.nodeBio && (
                          <p className={styles.requestBioPreview}>
                            "{stripHtml(req.nodeBio)}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={styles.requester}>
                      <span style={{ color: '#5a4e38', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitado por</span>
                      <p style={{ color: '#a89878', margin: '4px 0' }}>{req.requester.name || req.requester.email}</p>
                    </div>
                  </div>

                  {req.userNote && (
                    <div className={styles.userNotePreview}>
                      <span>Nota do Usuario</span>
                      <p>{req.userNote}</p>
                    </div>
                  )}

                  <div className={styles.cardActions}>
                    <button
                      onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                      className={styles.secondaryButton}
                    >
                      {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>

                    <div className={styles.reviewActions}>
                      <button
                        onClick={() => handleAction(req.id, 'reject')}
                        className={styles.dangerButton}
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        className={styles.primaryButton}
                      >
                        Aprovar
                      </button>
                    </div>
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
                        <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Foto</span>
                        {req.nodePhotoUrl ? (
                          <div
                            style={{
                              width: 96,
                              height: 96,
                              borderRadius: 10,
                              border: '1px solid #3a3020',
                              background: `url(${req.nodePhotoUrl}) center/cover no-repeat`,
                              marginTop: 8,
                            }}
                          />
                        ) : (
                          <p style={{ color: '#5a4e38', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                            Nenhuma foto enviada.
                          </p>
                        )}
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <span style={{ color: '#5a4e38', fontSize: 10, textTransform: 'uppercase' }}>Biografia</span>
                        {req.nodeBio ? (
                          <div style={{ color: '#c8b898', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                            <RichTextViewer value={req.nodeBio} />
                          </div>
                        ) : (
                          <p style={{ color: '#c8b898', margin: '6px 0 0', fontFamily: 'sans-serif', fontSize: 13 }}>
                            Nao informado
                          </p>
                        )}
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
                            {req.connections.map((connection) => {
                              const connectionRelationLabel = findRelationLabel(tag.relations, connection.relation);

                              return (
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
                                  <span style={{ color: '#c49a2a' }}>{connectionRelationLabel}</span>
                                  <span style={{ color: '#8a7856', fontSize: 12 }}>
                                    {connection.newNodeIsFrom ? 'Novo no -> alvo' : 'Alvo -> novo no'}
                                  </span>
                                </div>
                                {connection.description && (
                                  <p style={{ color: '#9a8a6a', margin: '8px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                                    {connection.description}
                                  </p>
                                )}
                                {(connection.documentTitle || connection.documentImageUrl || connection.documentContent) && (
                                  <div style={{ marginTop: 12, borderTop: '1px solid #2a2218', paddingTop: 12 }}>
                                    {connection.documentTitle && (
                                      <h4 style={{ color: '#f0e6d3', margin: '0 0 8px', fontSize: 15, fontFamily: '"DM Serif Display", Georgia, serif' }}>
                                        {connection.documentTitle}
                                      </h4>
                                    )}
                                    {connection.documentImageUrl && (
                                      <img
                                        src={connection.documentImageUrl}
                                        alt=""
                                        style={{
                                          width: '100%',
                                          maxHeight: 220,
                                          objectFit: 'cover',
                                          borderRadius: 6,
                                          border: '1px solid #2a2218',
                                          marginBottom: 10,
                                          display: 'block',
                                        }}
                                      />
                                    )}
                                    {connection.documentContent && (
                                      <div
                                        dangerouslySetInnerHTML={{ __html: connection.documentContent }}
                                        style={{
                                          color: '#d8ccb4',
                                          fontSize: 13,
                                          lineHeight: 1.7,
                                          overflowWrap: 'anywhere',
                                        }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                            })}
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
