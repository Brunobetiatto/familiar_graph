'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { handleKeyboardFormNavigation } from '@/lib/keyboard-navigation';
import RichTextEditor, { type RichTextImageAsset } from '@/app/components/RichTextEditor';
import {
  DEFAULT_GLOBAL_TAG_SLUG,
  OFFICIAL_GLOBAL_TAGS,
  type GlobalTag,
} from '@/lib/global-tags';
import {
  DEFAULT_GLOBAL_RELATIONS,
  type GlobalTagRelation,
} from '@/lib/global-relations';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';

type Connection = {
  targetNodeId: string;
  targetNodeName: string;
  relation: string;
  newNodeIsFrom: boolean;
  description: string;
  documentTitle: string;
  documentContent: string;
  documentImage: File | null;
  documentImages: RichTextImageAsset[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialConnection?: { id: string; name: string } | null;
  initialTagSlug?: string;
  isAuthenticated?: boolean;
};

const MAX_CONNECTIONS = 10;

export default function RequestNodeModal({
  isOpen,
  onClose,
  initialConnection,
  initialTagSlug = DEFAULT_GLOBAL_TAG_SLUG,
  isAuthenticated = true,
}: Props) {
  const [name, setName] = useState('');
  const [tagSlug, setTagSlug] = useState(initialTagSlug);
  const [gender, setGender] = useState<Gender>('');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [bio, setBio] = useState('');
  const [userNote, setUserNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [availableTags, setAvailableTags] = useState<GlobalTag[]>(OFFICIAL_GLOBAL_TAGS);
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : ''),
    [photoFile]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const relationOptions = useMemo<GlobalTagRelation[]>(() => {
    const selectedTag = availableTags.find((tag) => tag.slug === tagSlug);
    return selectedTag?.relations?.length ? selectedTag.relations : DEFAULT_GLOBAL_RELATIONS;
  }, [availableTags, tagSlug]);
  const defaultRelationKey = relationOptions[0]?.key ?? 'OTHER';
  const allowedRelationKeys = useMemo(
    () => new Set(relationOptions.map((relation) => relation.key)),
    [relationOptions]
  );

  useEffect(() => {
    if (!isOpen) return;
    setTagSlug(initialTagSlug);

    if (initialConnection && initialConnection.id) {
      setConnections((prev) => {
        if (prev.some((c) => c.targetNodeId === initialConnection.id)) return prev;
        if (prev.length >= MAX_CONNECTIONS) return prev;

        return [
          ...prev,
          {
            targetNodeId: initialConnection.id,
            targetNodeName: initialConnection.name,
            relation: defaultRelationKey,
            newNodeIsFrom: true,
            description: '',
            documentTitle: '',
            documentContent: '',
            documentImage: null,
            documentImages: [],
          },
        ];
      });
    }
  }, [defaultRelationKey, initialConnection, initialTagSlug, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchTags() {
      try {
        const res = await fetch('/api/global-tags');
        if (!res.ok) return;
        const tags = (await res.json()) as GlobalTag[];
        if (tags.length > 0) setAvailableTags(tags);
      } catch (err) {
        console.error('Erro ao buscar tags globais:', err);
      }
    }

    void fetchTags();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (searchQuery.length < 2 || connections.length >= MAX_CONNECTIONS) {
      setSearchResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery, tagSlug });
        const res = await fetch(`/api/nodes/search?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const filtered = data.filter(
          (node: { id: string }) => !connections.some((c) => c.targetNodeId === node.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error('Erro na busca', err);
      }
    }, 350);

    return () => clearTimeout(delay);
  }, [searchQuery, connections, isOpen, tagSlug]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    setConnections((prev) =>
      prev.map((conn) =>
        allowedRelationKeys.has(conn.relation)
          ? conn
          : { ...conn, relation: defaultRelationKey }
      )
    );
  }, [allowedRelationKeys, defaultRelationKey]);

  useEffect(() => {
    if (isOpen) return;

    setName('');
    setTagSlug(initialTagSlug);
    setGender('');
    setBirthDate('');
    setDeathDate('');
    setBio('');
    setUserNote('');
    setPhotoFile(null);
    setSearchQuery('');
    setSearchResults([]);
    setConnections([]);
    setError('');
    setSuccess(false);
  }, [initialTagSlug, isOpen]);

  if (!isOpen) return null;

  const handleAddConnection = (id: string, nameValue: string) => {
    if (connections.length >= MAX_CONNECTIONS) {
      setError(`Maximo de ${MAX_CONNECTIONS} conexoes atingido.`);
      return;
    }

    setConnections((prev) => [
      ...prev,
      {
        targetNodeId: id,
        targetNodeName: nameValue,
        relation: defaultRelationKey,
        newNodeIsFrom: true,
        description: '',
        documentTitle: '',
        documentContent: '',
        documentImage: null,
        documentImages: [],
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  const handleRemoveConnection = (id: string) => {
    setConnections((prev) => prev.filter((conn) => conn.targetNodeId !== id));
    setError('');
  };

  const updateConnection = (id: string, field: keyof Connection, value: Connection[keyof Connection]) => {
    setConnections((prev) =>
      prev.map((conn) => (conn.targetNodeId === id ? { ...conn, [field]: value } : conn))
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const payload = {
      nodeData: {
        name,
        tagSlug,
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        deathDate: deathDate ? new Date(deathDate).toISOString() : null,
        bio: bio || null,
        userNote: userNote || null,
      },
      connections: connections.map((conn) => ({
        targetNodeId: conn.targetNodeId,
        relation: conn.relation,
        newNodeIsFrom: conn.newNodeIsFrom,
        description: conn.description.trim() || null,
        documentTitle: conn.documentTitle.trim() || null,
        documentContent: conn.documentContent.trim() || null,
        documentImages: conn.documentImages.map((image) => ({ key: image.key })),
      })),
    };

    const formData = new FormData();
    formData.append('nodeData', JSON.stringify(payload.nodeData));
    formData.append('connections', JSON.stringify(payload.connections));
    if (photoFile) formData.append('photo', photoFile);
    connections.forEach((conn, index) => {
      if (conn.documentImage) {
        formData.append(`connectionDocumentImage-${index}`, conn.documentImage);
      }
      conn.documentImages.forEach((image) => {
        formData.append(`connectionDocumentInlineImage-${index}-${image.key}`, image.file);
      });
    });

    try {
      const res = await fetch('/api/node-requests', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao enviar solicitacao.');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar solicitacao.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="node-request-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: '"DM Serif Display", Georgia, serif',
        padding: 20,
        overflow: 'hidden',
      }}
    >
      <div
        className="node-request-modal-surface"
        style={{
          background: '#111009',
          border: '1px solid #3a3020',
          borderRadius: 12,
          padding: '24px 32px',
          width: '100%',
          maxWidth: 760,
          height: 'calc(100vh - 40px)',
          maxHeight: 780,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: '#5a4e38',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <h2 style={{ color: '#c49a2a', margin: '0 0 8px 0', fontSize: 24 }}>
          Solicitar novo no
        </h2>
        <p
          style={{
            color: '#8a7856',
            fontSize: 13,
            margin: '0 0 24px 0',
            fontFamily: 'sans-serif',
          }}
        >
          Crie um no isolado ou conecte a ate {MAX_CONNECTIONS} membros existentes.
        </p>

        {!isAuthenticated ? (
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(196,154,42,0.14), rgba(17,16,9,0.92))',
              border: '1px solid rgba(196,154,42,0.32)',
              borderRadius: 10,
              padding: '28px 24px',
              color: '#f0e6d3',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <span
              style={{
                color: '#c49a2a',
                fontFamily: 'sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Login necessario
            </span>
            <h3 style={{ fontSize: 24, lineHeight: 1.05, margin: 0 }}>
              Entre na sua conta para solicitar um novo no
            </h3>
            <p
              style={{
                color: '#c8b898',
                fontFamily: 'sans-serif',
                fontSize: 14,
                lineHeight: 1.55,
                margin: 0,
                maxWidth: 560,
              }}
            >
              As solicitacoes ficam vinculadas ao usuario para que os administradores possam
              revisar a origem, acompanhar o contexto e responder com seguranca.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              <a
                href="/login"
                style={{
                  alignItems: 'center',
                  background: '#c49a2a',
                  border: 'none',
                  borderRadius: 6,
                  color: '#111009',
                  display: 'inline-flex',
                  fontFamily: 'sans-serif',
                  fontSize: 14,
                  fontWeight: 800,
                  justifyContent: 'center',
                  minHeight: 42,
                  padding: '0 18px',
                  textDecoration: 'none',
                }}
              >
                Fazer login
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(15,13,11,0.72)',
                  border: '1px solid #3a3020',
                  borderRadius: 6,
                  color: '#c8b898',
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 16px',
                }}
              >
                Voltar ao grafo
              </button>
            </div>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4CAF50' }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Solicitacao enviada!</h3>
            <p style={{ fontSize: 14 }}>Ela sera analisada por um administrador.</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            onKeyDown={handleKeyboardFormNavigation}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}
          >
            <div style={{ background: '#181410', padding: 16, borderRadius: 8, border: '1px solid #2a2218' }}>
              <h3
                style={{
                  margin: '0 0 16px 0',
                  fontSize: 14,
                  color: '#f0e6d3',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                1. Dados do novo no
              </h3>

              <div className="node-request-modal-grid" style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 2 }}>
                  <Label>Nome completo *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Tema</Label>
                  <Select value={tagSlug} onChange={(e) => setTagSlug(e.target.value)}>
                    {availableTags.map((tag) => (
                      <option key={tag.slug} value={tag.slug}>
                        {tag.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Genero</Label>
                  <Select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                    <option value="">Selecione...</option>
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Feminino</option>
                    <option value="OTHER">Outro</option>
                  </Select>
                </div>
              </div>

              <div className="node-request-modal-grid" style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Label>Nascimento</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Falecimento</Label>
                  <Input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <Label>Biografia breve</Label>
                <RichTextEditor
                  value={bio}
                  onChange={setBio}
                  citationTagSlug={tagSlug}
                  allowImages={false}
                  minHeight={96}
                  placeholder="Resumo, contexto e citacoes internas..."
                />
              </div>

              <div className="node-request-modal-photo-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    border: '1px solid #3a3020',
                    background: photoPreviewUrl
                      ? `url(${photoPreviewUrl}) center/cover no-repeat`
                      : '#0f0d0b',
                    color: '#5a4e38',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    flexShrink: 0,
                    overflow: 'hidden',
                    fontFamily: 'sans-serif',
                  }}
                >
                  {!photoPreviewUrl && 'Foto'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Label>Foto do no</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => setPhotoFile(null)}
                    style={{ background: 'none', border: 'none', color: '#8a7856', cursor: 'pointer', fontSize: 12 }}
                  >
                    Remover
                  </button>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <Label>Nota para o administrador</Label>
                <Input
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="Ex: fontes, contexto familiar, etc."
                />
              </div>
            </div>

            <div style={{ background: '#181410', padding: 16, borderRadius: 8, border: '1px solid #2a2218' }}>
              <h3
                style={{
                  margin: '0 0 16px 0',
                  fontSize: 14,
                  color: '#f0e6d3',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                2. Conexoes ({connections.length}/{MAX_CONNECTIONS}) - opcional
              </h3>

              <div style={{ position: 'relative', marginBottom: connections.length > 0 ? 16 : 0 }}>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar nos existentes no grafo..."
                  disabled={connections.length >= MAX_CONNECTIONS}
                />
                {searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#231d16',
                      border: '1px solid #3a3020',
                      borderRadius: 6,
                      marginTop: 4,
                      zIndex: 10,
                      maxHeight: 180,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                    }}
                  >
                    {searchResults.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => handleAddConnection(res.id, res.name)}
                        style={{
                          padding: '10px 12px',
                          color: '#c8b898',
                          cursor: 'pointer',
                          borderBottom: '1px solid #2a2218',
                          fontFamily: 'sans-serif',
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        + {res.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {connections.length === 0 && (
                <p style={{ color: '#5a4e38', fontSize: 12, margin: 0, fontFamily: 'sans-serif' }}>
                  Nenhuma conexao adicionada. Voce pode enviar a solicitacao mesmo assim.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {connections.map((conn) => (
                  <div
                    key={conn.targetNodeId}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: '#111009',
                      padding: 12,
                      borderRadius: 6,
                      border: '1px dashed #3a3020',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        width: '100%',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            color: '#5a4e38',
                            display: 'block',
                            fontFamily: 'sans-serif',
                            fontSize: 10,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Conectando com
                        </span>
                        <strong
                          title={conn.targetNodeName}
                          style={{
                            color: '#c49a2a',
                            display: 'block',
                            fontSize: 15,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {conn.targetNodeName}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveConnection(conn.targetNodeId)}
                        style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 16 }}
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="node-request-modal-grid" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      <Select
                        style={{ flex: 1 }}
                        value={conn.newNodeIsFrom ? 'FROM' : 'TO'}
                        onChange={(e) =>
                          updateConnection(conn.targetNodeId, 'newNodeIsFrom', e.target.value === 'FROM')
                        }
                      >
                        <option value="FROM">Seta sai do novo no</option>
                        <option value="TO">Seta chega no novo no</option>
                      </Select>

                      <Select
                        style={{ flex: 1 }}
                        value={conn.relation}
                        onChange={(e) =>
                          updateConnection(conn.targetNodeId, 'relation', e.target.value)
                        }
                      >
                        {relationOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div style={{ width: '100%' }}>
                      <Label>Resumo curto da conexao</Label>
                      <textarea
                        value={conn.description}
                        onChange={(e) =>
                          updateConnection(conn.targetNodeId, 'description', e.target.value)
                        }
                        placeholder="Ex: Conheceram-se na escola em 1998 e mantiveram contato pela familia."
                        style={{ ...inputStyle, minHeight: 54, maxHeight: 120, resize: 'none', overflowY: 'auto' }}
                      />
                    </div>

                    <div style={{ width: '100%' }}>
                      <Label>Titulo do documento</Label>
                      <Input
                        value={conn.documentTitle}
                        onChange={(e) =>
                          updateConnection(conn.targetNodeId, 'documentTitle', e.target.value)
                        }
                        placeholder={`Ligacao com ${conn.targetNodeName}`}
                      />
                    </div>

                    <div style={{ width: '100%' }}>
                      <Label>Imagem do documento</Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) =>
                          updateConnection(
                            conn.targetNodeId,
                            'documentImage',
                            e.target.files?.[0] ?? null
                          )
                        }
                      />
                      {conn.documentImage && (
                        <button
                          type="button"
                          onClick={() => updateConnection(conn.targetNodeId, 'documentImage', null)}
                          style={{ marginTop: 6, background: 'none', border: 'none', color: '#8a7856', cursor: 'pointer', fontSize: 12 }}
                        >
                          Remover {conn.documentImage.name}
                        </button>
                      )}
                    </div>

                    <div style={{ width: '100%' }}>
                      <Label>Documento da ligacao</Label>
                      <RichTextEditor
                        value={conn.documentContent}
                        onChange={(value) =>
                          updateConnection(conn.targetNodeId, 'documentContent', value)
                        }
                        citationTagSlug={tagSlug}
                        imageAssets={conn.documentImages}
                        onImageAssetsChange={(images) =>
                          updateConnection(conn.targetNodeId, 'documentImages', images)
                        }
                        placeholder="Escreva a historia, fontes e detalhes desta ligacao..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0, fontFamily: 'sans-serif' }}>{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '12px',
                background: isLoading ? '#3a3020' : '#c49a2a',
                color: isLoading ? '#8a7856' : '#111009',
                border: 'none',
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isLoading ? 'Enviando...' : 'Enviar solicitacao'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #3a3020',
  background: '#0f0d0b',
  color: '#f0e6d3',
  fontFamily: 'sans-serif',
  fontSize: 13,
  outline: 'none',
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <label
    style={{
      display: 'block',
      color: '#5a4e38',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

const Input = ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} style={inputStyle} />
);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      ...inputStyle,
      appearance: 'none',
      background: '#0f0d0b',
    }}
  >
    {children}
  </select>
);
