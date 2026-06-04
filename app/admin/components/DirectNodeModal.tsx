'use client';

import { useMemo, useState, useEffect } from 'react';
import { handleKeyboardFormNavigation } from '@/lib/keyboard-navigation';

type Connection = {
  targetNodeId: string;
  targetNodeName: string;
  relation: string;
  newNodeIsFrom: boolean;
  description: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Para recarregar a lista do painel se necessário
};

export default function DirectNodeModal({ isOpen, onClose, onSuccess }: Props) {
  // Dados do Nó
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : ''),
    [photoFile]
  );

  // Estados de Conexão e Pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Estados de UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Efeito para pesquisar nós (Debounce simples)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/nodes/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filtra para não mostrar nós que já estão na lista de conexões
          const filtered = data.filter((n: any) => !connections.find((c) => c.targetNodeId === n.id));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Erro na busca', err);
      }
    }, 400); // Aguarda 400ms após o admin parar de digitar

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, connections]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  if (!isOpen) return null;

  // Adiciona um nó selecionado da pesquisa à lista de conexões (máx 5)
  const handleAddConnection = (targetId: string, targetName: string) => {
    if (connections.length >= 5) {
      setError('Máximo de 5 conexões atingido.');
      return;
    }
    setConnections([
      ...connections,
      {
        targetNodeId: targetId,
        targetNodeName: targetName,
        relation: 'FRIEND',
        newNodeIsFrom: true,
        description: '',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove uma conexão da lista
  const handleRemoveConnection = (idToRemove: string) => {
    setConnections(connections.filter((c) => c.targetNodeId !== idToRemove));
    setError('');
  };

  // Atualiza os dados (relation ou direção) de uma conexão específica
  const updateConnection = (id: string, field: keyof Connection, value: any) => {
    setConnections((prev) =>
      prev.map((c) => (c.targetNodeId === id ? { ...c, [field]: value } : c))
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
        bio: bio || null,
      },
      connections: connections.map((connection) => ({
        ...connection,
        description: connection.description.trim() || null,
      })),
    };

    const formData = new FormData();
    formData.append('nodeData', JSON.stringify(payload.nodeData));
    formData.append('connections', JSON.stringify(payload.connections));
    if (photoFile) formData.append('photo', photoFile);

    try {
      const res = await fetch('/api/admin/nodes', {
        method: 'POST',
        body: formData,
      });

      // NOVO TRATAMENTO DE ERRO BLINDADO
      if (!res.ok) {
        const textResponse = await res.text(); // Lê a resposta como texto bruto primeiro
        try {
          const data = JSON.parse(textResponse); // Tenta converter para JSON
          throw new Error(data.error || 'Erro ao criar o nó.');
        } catch (parseError) {
          // Se não for JSON (ex: HTML 404 ou 500), joga o erro bruto para a tela
          throw new Error(`Erro do Servidor (Status ${res.status}). Verifique o terminal do Next.js.`);
        }
      }

      // Sucesso total
      setName(''); setGender(''); setBirthDate(''); setBio(''); setPhotoFile(null); setConnections([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, fontFamily: '"DM Serif Display", Georgia, serif', padding: 20, overflow: 'hidden'
      }}
    >
      <div
        style={{
          background: '#111009', border: '1px solid #3a3020', borderRadius: 12, padding: '24px 32px',
          width: '100%', maxWidth: 700, height: 'calc(100vh - 40px)', maxHeight: 760, overflowY: 'auto', overflowX: 'hidden', position: 'relative',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#5a4e38', fontSize: 20, cursor: 'pointer' }}
        >
          ✕
        </button>

        <h2 style={{ color: '#c49a2a', margin: '0 0 8px 0', fontSize: 24 }}>Injeção Direta de Nó</h2>
        <p style={{ color: '#8a7856', fontSize: 13, margin: '0 0 24px 0', fontFamily: 'sans-serif' }}>
          Crie um nó isolado ou anexe-o a até 5 conexões existentes no Grafo.
        </p>

        <form
          onSubmit={handleSubmit}
          onKeyDown={handleKeyboardFormNavigation}
          style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}
        >
          
          {/* Seção 1: Dados do Nó */}
          <div style={{ background: '#181410', padding: 16, borderRadius: 8, border: '1px solid #2a2218' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#f0e6d3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Dados do Novo Nó</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <Label>Nome Completo *</Label>
                <Input value={name} onChange={(e: any) => setName(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Gênero</Label>
                <Select value={gender} onChange={(e: any) => setGender(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="MALE">Masculino</option>
                  <option value="FEMALE">Feminino</option>
                </Select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Label>Nascimento</Label>
                <Input type="date" value={birthDate} onChange={(e: any) => setBirthDate(e.target.value)} />
              </div>
              <div style={{ flex: 2 }}>
                <Label>Biografia Breve</Label>
                <Input value={bio} onChange={(e: any) => setBio(e.target.value)} placeholder="Breve resumo..." />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
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
                  onChange={(e: any) => setPhotoFile(e.target.files?.[0] ?? null)}
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
          </div>

          {/* Seção 2: Conexões (Opcional) */}
          <div style={{ background: '#181410', padding: 16, borderRadius: 8, border: '1px solid #2a2218' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#f0e6d3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2. Conexões ({connections.length}/5) - Opcional
            </h3>
            
            {/* Barra de Pesquisa */}
            <div style={{ position: 'relative', marginBottom: connections.length > 0 ? 16 : 0 }}>
              <Input 
                value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} 
                placeholder="Pesquisar nós existentes no grafo..." 
                disabled={connections.length >= 5}
              />
              {/* Resultados do Autocomplete */}
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#231d16', border: '1px solid #3a3020', borderRadius: 6, marginTop: 4, zIndex: 10, maxHeight: 180, overflowY: 'auto', overflowX: 'hidden' }}>
                  {searchResults.map(res => (
                    <div 
                      key={res.id} onClick={() => handleAddConnection(res.id, res.name)}
                      style={{ padding: '10px 12px', color: '#c8b898', cursor: 'pointer', borderBottom: '1px solid #2a2218', fontFamily: 'sans-serif', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      + {res.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de Conexões Selecionadas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connections.map((conn) => (
                <div key={conn.targetNodeId} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#111009', padding: 12, borderRadius: 6, border: '1px dashed #3a3020' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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

                    <button type="button" onClick={() => handleRemoveConnection(conn.targetNodeId)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 16 }}>
                      🗑️
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Direção da Linha */}
                    <Select style={{ flex: 1 }} value={conn.newNodeIsFrom ? 'FROM' : 'TO'} onChange={(e: any) => updateConnection(conn.targetNodeId, 'newNodeIsFrom', e.target.value === 'FROM')}>
                      <option value="FROM">Seta sai do Novo Nó</option>
                      <option value="TO">Seta chega no Novo Nó</option>
                    </Select>

                    {/* Tipo de Relação */}
                    <Select style={{ flex: 1 }} value={conn.relation} onChange={(e: any) => updateConnection(conn.targetNodeId, 'relation', e.target.value)}>
                      <option value="PARENT">Pai/Mãe</option>
                      <option value="CHILD">Filho(a)</option>
                      <option value="SPOUSE">Cônjuge</option>
                      <option value="FRIEND">Amigo(a)</option>
                      <option value="TEAMMATE">Colega de Equipe</option>
                    </Select>
                  </div>

                  <div>
                    <Label>Como essa conexão aconteceu</Label>
                    <textarea
                      value={conn.description}
                      onChange={(e: any) => updateConnection(conn.targetNodeId, 'description', e.target.value)}
                      placeholder="Ex: Trabalharam juntos no mesmo projeto em 2021."
                      style={{ ...inputStyle, minHeight: 54, maxHeight: 120, resize: 'none', overflowY: 'auto' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0, fontFamily: 'sans-serif' }}>{error}</p>}

          {/* Botão de Submit */}
          <button
            type="submit" disabled={isLoading}
            style={{
              padding: '12px', background: isLoading ? '#3a3020' : '#c49a2a', color: '#111009',
              border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {isLoading ? 'Injetando no Grafo...' : 'Criar e Injetar Nó'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Sub-componentes visuais mantidos da identidade do projeto
const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display: 'block', color: '#5a4e38', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{children}</label>
);
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#1a1611', border: '1px solid #3a3020', borderRadius: 6, color: '#f0e6d3', fontSize: 14, fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none'
};
const Input = (props: any) => <input style={inputStyle} {...props} />;
const Select = (props: any) => <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', ...props.style }} {...props}>{props.children}</select>;
