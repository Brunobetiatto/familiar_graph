export const PASSWORD_RULES = {
  minLength: 10,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /\d/,
  symbol: /[^A-Za-z0-9]/,
};

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function validateEmail(email: string) {
  if (!email) return 'E-mail e obrigatorio.';
  if (email.length > 254) return 'E-mail muito longo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail valido.';
  return null;
}

export function getPasswordErrors(password: unknown) {
  const value = typeof password === 'string' ? password : '';
  const errors: string[] = [];

  if (value.length < PASSWORD_RULES.minLength) {
    errors.push(`Use pelo menos ${PASSWORD_RULES.minLength} caracteres.`);
  }
  if (!PASSWORD_RULES.uppercase.test(value)) errors.push('Inclua uma letra maiuscula.');
  if (!PASSWORD_RULES.lowercase.test(value)) errors.push('Inclua uma letra minuscula.');
  if (!PASSWORD_RULES.number.test(value)) errors.push('Inclua um numero.');
  if (!PASSWORD_RULES.symbol.test(value)) errors.push('Inclua um simbolo.');
  if (/\s/.test(value)) errors.push('Evite espacos na senha.');

  return errors;
}

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalForAuth = globalThis as unknown as {
  authRateLimit?: Map<string, RateLimitBucket>;
};

const authRateLimit = globalForAuth.authRateLimit ?? new Map<string, RateLimitBucket>();
globalForAuth.authRateLimit = authRateLimit;

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = authRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    authRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
