'use client';

import { useEffect, useState, type CSSProperties } from 'react';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';

type RelationType =
  | 'PARENT'
  | 'CHILD'
  | 'SPOUSE'
  | 'SIBLING'
  | 'FRIEND'
  | 'ACQUAINTANCE'
  | 'ROMANTIC'
  | 'COLLEAGUE'
  | 'TEAMMATE'
  | 'MENTOR'
  | 'STUDENT'
  | 'PARTNER'
  | 'OTHER';

type Connection = {
  targetNodeId: string;
  targetNodeName: string;
  relation: RelationType;
  newNodeIsFrom: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialConnection?: { id: string; name: string } | null;
};

const MAX_CONNECTIONS = 10;

const RELATION_OPTIONS: Array<{ value: RelationType; label: string }> = [
  { value: 'PARENT', label: 'Pai/Mae' },
  { value: 'CHILD', label: 'Filho(a)' },
  { value: 'SPOUSE', label: 'Conjuge' },
  { value: 'SIBLING', label: 'Irmao(a)' },
  { value: 'FRIEND', label: 'Amigo(a)' },
  { value: 'ACQUAINTANCE', label: 'Conhecido(a)' },
  { value: 'ROMANTIC', label: 'Romantico(a)' },
  { value: 'COLLEAGUE', label: 'Colega' },
  { value: 'TEAMMATE', label: 'Companheiro(a) de equipe' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'STUDENT', label: 'Estudante' },
  { value: 'PARTNER', label: 'Parceiro(a)' },
  { value: 'OTHER', label: 'Outro' },
];

export default function RequestNodeModal({ isOpen, onClose, initialConnection }: Props) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [bio, setBio] = useState('');
  const [userNote, setUserNote] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialConnection && initialConnection.id) {
      setConnections((prev) => {
        if (prev.some((c) => c.targetNodeId === initialConnection.id)) return prev;
        if (prev.length >= MAX_CONNECTIONS) return prev;

        return [
          ...prev,
          {
            targetNodeId: initialConnection.id,
            targetNodeName: initialConnection.name,
            relation: 'FRIEND',
            newNodeIsFrom: true,
          },
        ];
      });
    }
  }, [initialConnection, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (searchQuery.length < 2 || connections.length >= MAX_CONNECTIONS) {
      setSearchResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nodes/search?q=${encodeURIComponent(searchQuery)}`);
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
  }, [searchQuery, connections, isOpen]);

  useEffect(() => {
    if (isOpen) return;

    setName('');
    setGender('');
    setBirthDate('');
    setDeathDate('');
    setBio('');
    setUserNote('');
    setSearchQuery('');
    setSearchResults([]);
    setConnections([]);
    setError('');
    setSuccess(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddConnection = (id: string, nameValue: string) => {
    if (connections.length >= MAX_CONNECTIONS) {
      setError(`Maximo de ${MAX_CONNECTIONS} conexoes atingido.`);
      return;
    }

    setConnections((prev) => [
      ...prev,
      { targetNodeId: id, targetNodeName: nameValue, relation: 'FRIEND', newNodeIsFrom: true },
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
      })),
    };

    try {
      const res = await fetch('/api/node-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      }}
    >
      <div
        style={{
          background: '#111009',
          border: '1px solid #3a3020',
          borderRadius: 12,
          padding: '24px 32px',
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
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

        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4CAF50' }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Solicitacao enviada!</h3>
            <p style={{ fontSize: 14 }}>Ela sera analisada por um administrador.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 2 }}>
                  <Label>Nome completo *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
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

              <div style={{ display: 'flex', gap: 16 }}>
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
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                />
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
                      maxHeight: 150,
                      overflowY: 'auto',
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
                      alignItems: 'center',
                      gap: 12,
                      background: '#111009',
                      padding: 12,
                      borderRadius: 6,
                      border: '1px dashed #3a3020',
                    }}
                  >
                    <span style={{ color: '#c49a2a', flex: 1, fontSize: 14 }}>{conn.targetNodeName}</span>

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
                        updateConnection(conn.targetNodeId, 'relation', e.target.value as RelationType)
                      }
                    >
                      {RELATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <button
                      type="button"
                      onClick={() => handleRemoveConnection(conn.targetNodeId)}
                      style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 16 }}
                    >
                      🗑️
                    </button>
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
