'use client';

import { useState, useEffect } from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string;
  targetNodeName: string;
};

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';
type RelationType = 'CHILD' | 'PARENT' | 'SPOUSE' | 'FRIEND' | 'ACQUAINTANCE' | 'ROMANTIC' | 'COLLEAGUE' | 'TEAMMATE' | 'MENTOR' | 'STUDENT' | 'PARTNER' | 'OTHER';

interface LabelProps {
  children: React.ReactNode;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export default function ConnectionModal({ isOpen, onClose, targetNodeId, targetNodeName }: Props) {
  // Estados do formulário
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [userNote, setUserNote] = useState('');
  const [connectionDescription, setConnectionDescription] = useState('');
  
  // Controle de relacionamento
  const [relationType, setRelationType] = useState<RelationType>('CHILD');

  // Estados de UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fecha no Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Traduz a seleção do usuário para o formato do banco de dados
    let relation = 'PARENT';
    let newNodeIsFrom = false;

    if (relationType === 'PARENT') {
      relation = 'PARENT';
      newNodeIsFrom = true; // O novo nó é a origem (Pai -> Alvo)
    } else if (relationType === 'CHILD') {
      relation = 'PARENT';
      newNodeIsFrom = false; // O novo nó é o destino (Alvo -> Filho)
    } else if (relationType === 'SPOUSE') {
      relation = 'SPOUSE';
      newNodeIsFrom = false;
    }

    const payload = {
      // ATENÇÃO: Como não temos Auth ainda, coloque um ID válido da sua tabela USER aqui para testar
      userId: 'COLE_AQUI_UM_ID_DE_USUARIO_VALIDO_DO_BANCO', 
      nodeData: {
        name,
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        bio: bio || null,
        userNote: userNote || null,
      },
      connectionData: {
        globalNodeId: targetNodeId,
        relation,
        newNodeIsFrom,
        description: connectionDescription || null,
      },
    };

    try {
      const res = await fetch('/api/node-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao enviar solicitação.');
      }

      setSuccess(true);
      // Limpa o formulário após 2 segundos e fecha
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setName('');
        setGender('');
        setBirthDate('');
        setBio('');
        setUserNote('');
        setConnectionDescription('');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar solicitação.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
        fontFamily: '"DM Serif Display", Georgia, serif',
        padding: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#111009',
          border: '1px solid #3a3020',
          borderRadius: 12,
          padding: '24px 32px',
          width: '100%',
          maxWidth: 500,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: '#5a4e38',
            fontSize: 20, cursor: 'pointer', transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#c49a2a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#5a4e38')}
        >
          ✕
        </button>

        <h2 style={{ color: '#c49a2a', margin: '0 0 8px 0', fontSize: 24 }}>
          Adicionar Familiar
        </h2>
        <p style={{ color: '#8a7856', fontSize: 14, margin: '0 0 24px 0' }}>
          Conectando a: <strong style={{ color: '#f0e6d3' }}>{targetNodeName}</strong>
        </p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4CAF50' }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Solicitação enviada!</h3>
            <p style={{ fontSize: 14 }}>Ela será analisada por um administrador.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {/* Nome e Parentesco */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 2 }}>
                <Label>Nome Completo *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Parentesco *</Label>
                <Select value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType)}>
                  <option value="CHILD">Filho(a)</option>
                  <option value="PARENT">Pai / Mãe</option>
                  <option value="SPOUSE">Cônjuge</option>
                  <option value="FRIEND">Amigo(a)</option>
                  <option value="ACQUAINTANCE">Conhecido(a)</option>
                  <option value="ROMANTIC">Romântico(a)</option>
                  <option value="COLLEAGUE">Colega</option>
                  <option value="TEAMMATE">Companheiro de Equipe</option>
                  <option value="MENTOR">Mentor</option>
                  <option value="STUDENT">Estudante</option>
                  <option value="PARTNER">Parceiro(a)</option>
                  <option value="OTHER">Outro</option>

                </Select>
              </div>
            </div>

            {/* Gênero e Nascimento */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Label>Gênero</Label>
                <Select value={gender} onChange={(e) => setGender(e.target.value as any)}>
                  <option value="">Selecione...</option>
                  <option value="MALE">Masculino</option>
                  <option value="FEMALE">Feminino</option>
                  <option value="OTHER">Outro</option>
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Data de Nascimento</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>

            {/* Biografia */}
            <div>
              <Label>Biografia Curta</Label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value)}
                style={{ ...inputStyle, minHeight: 54, maxHeight: 120, resize: 'none', overflowY: 'auto' }}
              />
            </div>

            {/* Nota para o admin */}
            <div>
              <Label>Como essa conexão aconteceu</Label>
              <textarea
                value={connectionDescription}
                onChange={(e) => setConnectionDescription(e.target.value)}
                placeholder="Ex: Foram vizinhos durante a infância e as famílias mantiveram contato."
                style={{ ...inputStyle, minHeight: 54, maxHeight: 120, resize: 'none', overflowY: 'auto' }}
              />
            </div>

            <div>
              <Label>Nota para o Administrador</Label>
              <Input
                value={userNote} onChange={(e) => setUserNote(e.target.value)}
                placeholder="Ex: Tio por parte de mãe, fontes no site X..."
              />
            </div>

            {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{error}</p>}

            {/* Botão Salvar */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: 8, padding: '12px', background: isLoading ? '#3a3020' : '#c49a2a',
                color: isLoading ? '#8a7856' : '#111009', border: 'none', borderRadius: 6,
                fontSize: 15, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', fontFamily: 'inherit'
              }}
            >
              {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes visuais para o formulário ────────────────────────────────

const Label = ({ children }: LabelProps) => (
  <label style={{ display: 'block', color: '#5a4e38', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#1a1611',
  border: '1px solid #3a3020', borderRadius: 6, color: '#f0e6d3',
  fontSize: 14, fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none'
};

const Input = (props: InputProps) => (
  <input style={inputStyle} {...props} onFocus={(e) => e.currentTarget.style.borderColor = '#c49a2a'} onBlur={(e) => e.currentTarget.style.borderColor = '#3a3020'} />
);

const Select = (props: SelectProps) => (
  <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} {...props}>
    {props.children}
  </select>
);
