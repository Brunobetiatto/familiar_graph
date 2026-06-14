'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleKeyboardFormNavigation } from '@/lib/keyboard-navigation';
import VantaNetBackground from '@/app/components/VantaNetBackground';
import styles from './login.module.css';

type Requirement = {
  label: string;
  valid: boolean;
};

function getPasswordRequirements(password: string): Requirement[] {
  return [
    { label: '10 caracteres ou mais', valid: password.length >= 10 },
    { label: 'Letra maiuscula', valid: /[A-Z]/.test(password) },
    { label: 'Letra minuscula', valid: /[a-z]/.test(password) },
    { label: 'Numero', valid: /\d/.test(password) },
    { label: 'Simbolo', valid: /[^A-Za-z0-9]/.test(password) },
    { label: 'Sem espacos', valid: password.length > 0 && !/\s/.test(password) },
  ];
}

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  const passwordRequirements = useMemo(() => getPasswordRequirements(password), [password]);
  const passwordScore = passwordRequirements.filter((item) => item.valid).length;
  const canSubmitRegister =
    passwordScore === passwordRequirements.length && password === confirmPassword;

  function switchMode(nextLoginMode: boolean) {
    setIsLoginMode(nextLoginMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLoginMode && password !== confirmPassword) {
      setError('As senhas nao conferem.');
      return;
    }

    if (!isLoginMode && !canSubmitRegister) {
      setError('Complete os requisitos de senha antes de criar a conta.');
      return;
    }

    setIsLoading(true);

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode
      ? { email, password }
      : { email, password, confirmPassword, name, website };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.details) ? ` ${data.details.join(' ')}` : '';
        throw new Error(`${data.error || 'Ocorreu um erro.'}${details}`);
      }

      if (isLoginMode) {
        router.push('/global-graph');
        router.refresh();
      } else {
        setSuccessMsg('Conta criada. Agora faca login para continuar.');
        switchMode(true);
        setEmail(email.trim().toLowerCase());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <VantaNetBackground disableOnMobile />
      <div className={styles.overlay} aria-hidden="true" />

      <section className={styles.shell} aria-labelledby="auth-title">
        <section className={styles.authCard} aria-label={isLoginMode ? 'Login' : 'Cadastro'}>
          <div className={styles.topBar}>
            <Link href="/" className={styles.backLink}>
              Voltar
            </Link>
            <span className={styles.brandMark}>Familiar Graph</span>
          </div>

          <div className={styles.modeTabs} role="tablist" aria-label="Escolha login ou cadastro">
            <button
              type="button"
              className={`${styles.modeTab} ${isLoginMode ? styles.modeTabActive : ''}`}
              onClick={() => switchMode(true)}
              role="tab"
              aria-selected={isLoginMode}
            >
              Login
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${!isLoginMode ? styles.modeTabActive : ''}`}
              onClick={() => switchMode(false)}
              role="tab"
              aria-selected={!isLoginMode}
            >
              Cadastro
            </button>
          </div>

          <div className={styles.bodyShell}>
            <div key={isLoginMode ? 'login' : 'register'} className={styles.bodyContent}>
              <div className={styles.cardHeader}>
                <h1 id="auth-title">{isLoginMode ? 'Acessar conta' : 'Criar conta'}</h1>
              </div>

              {successMsg && <p className={`${styles.alert} ${styles.alertSuccess}`}>{successMsg}</p>}
              {error && <p className={`${styles.alert} ${styles.alertError}`}>{error}</p>}

              <form
                className={styles.form}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyboardFormNavigation}
              >
                <input
                  className={styles.honeypot}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  aria-hidden="true"
                />

                {!isLoginMode && (
                  <label className={`${styles.field} ${styles.revealField}`}>
                    <span>Nome</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como voce quer aparecer"
                      autoComplete="name"
                      maxLength={80}
                    />
                  </label>
                )}

                <label className={`${styles.field} ${styles.revealField}`}>
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu-email@exemplo.com"
                    autoComplete="email"
                    required
                  />
                </label>

                <label className={`${styles.field} ${styles.revealField}`}>
                  <span>Senha</span>
                  <div className={styles.passwordInput}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isLoginMode ? 'Sua senha' : 'Crie uma senha forte'}
                      autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </label>

                {!isLoginMode && (
                  <>
                    <label className={`${styles.field} ${styles.revealField}`}>
                      <span>Confirmar senha</span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                        required
                      />
                    </label>

                    <div className={`${styles.passwordPanel} ${styles.revealField}`}>
                      <div className={styles.strengthBar} aria-hidden="true">
                        <span style={{ width: `${(passwordScore / passwordRequirements.length) * 100}%` }} />
                      </div>
                      <div className={styles.requirements}>
                        {passwordRequirements.map((item) => (
                          <span
                            key={item.label}
                            className={item.valid ? styles.requirementValid : ''}
                          >
                            {item.valid ? '✓' : '•'} {item.label}
                          </span>
                        ))}
                        <span className={password === confirmPassword && password ? styles.requirementValid : ''}>
                          {password === confirmPassword && password ? '✓' : '•'} Senhas iguais
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (!isLoginMode && !canSubmitRegister)}
                  className={styles.submitButton}
                >
                  {isLoading ? 'Verificando...' : isLoginMode ? 'Entrar' : 'Criar conta'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
