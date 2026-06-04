'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleKeyboardFormNavigation } from '@/lib/keyboard-navigation';
import VantaNetBackground from '@/app/components/VantaNetBackground';

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true); // Alterna entre Login e Registro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Usado apenas no registro
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode ? { email, password } : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocorreu um erro.');
      }

      if (isLoginMode) {
        // Se for login e deu sucesso, redireciona
        router.push('/graph-choice');
        router.refresh();
      } else {
        // Se for registro, avisa sucesso e muda para a aba de login
        setSuccessMsg('Conta criada! Agora você pode fazer login.');
        setIsLoginMode(true);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        height: '100vh', width: '100vw',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f0d0b', fontFamily: '"DM Serif Display", Georgia, serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <VantaNetBackground />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(circle at 50% 42%, rgba(196,154,42,0.12), rgba(15,13,11,0.32) 42%, rgba(15,13,11,0.82) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'rgba(17, 16, 9, 0.86)',
          border: '1px solid rgba(196,154,42,0.22)',
          borderRadius: 12,
          padding: '40px 32px', width: '100%', maxWidth: 400,
          boxShadow: '0 24px 60px rgba(0,0,0,0.82), 0 0 32px rgba(196,154,42,0.08)',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h1 style={{ color: '#c49a2a', margin: '0 0 6px 0', fontSize: 28 }}>
          Familiar Graph
        </h1>
        <p style={{ color: '#8a7856', fontSize: 14, margin: '0 0 32px 0', fontFamily: 'sans-serif' }}>
          {isLoginMode ? 'Acesse sua conta para continuar' : 'Crie sua conta para colaborar'}
        </p>

        {successMsg && <p style={{ color: '#4CAF50', fontSize: 13, marginBottom: 16, fontFamily: 'sans-serif' }}>{successMsg}</p>}
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 16, fontFamily: 'sans-serif' }}>{error}</p>}

        <form
          onSubmit={handleSubmit}
          onKeyDown={handleKeyboardFormNavigation}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}
        >
          
          {!isLoginMode && (
            <div>
              <label style={labelStyle}>Nome (Opcional)</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome" style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@exemplo.com" required style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Senha</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required style={inputStyle}
            />
          </div>

          <button
            type="submit" disabled={isLoading}
            style={{
              marginTop: 8, padding: '12px', background: isLoading ? '#3a3020' : '#c49a2a',
              color: isLoading ? '#8a7856' : '#111009', border: 'none', borderRadius: 6,
              fontSize: 15, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', fontFamily: 'inherit'
            }}
          >
            {isLoading ? 'Aguarde...' : (isLoginMode ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 13, color: '#8a7856', fontFamily: 'sans-serif' }}>
          {isLoginMode ? "Ainda não tem conta? " : "Já possui conta? "}
          <button
            type="button"
            onClick={() => { setIsLoginMode(!isLoginMode); setError(''); setSuccessMsg(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#c49a2a',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 'bold',
              padding: 0,
            }}
          >
            {isLoginMode ? "Registre-se aqui." : "Faça login."}
          </button>
        </p>
      </div>
    </div>
  );
}

// Sub-componentes de estilo
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#5a4e38', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: '#1a1611', border: '1px solid #3a3020',
  borderRadius: 6, color: '#f0e6d3', fontSize: 14, fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none'
};
