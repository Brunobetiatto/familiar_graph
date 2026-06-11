import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import {
  checkRateLimit,
  getClientIp,
  normalizeEmail,
  validateEmail,
} from '@/lib/auth-security';

const DUMMY_PASSWORD_HASH =
  '$2b$10$96kl0dSjPm7McJyJHCILauqSRSXBifFHBd1L87pYx/NDL9d.eRyZi';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${ip}`, 12, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${rateLimit.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const { email: rawEmail, password } = await request.json();
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // 1. Busca o usuário pelo e-mail
    const user = await prisma.user.findUnique({ where: { email } });
    
    // 2. Compara a senha enviada em texto limpo com o Hash do banco de dados
    const isPasswordValid = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
    
    if (!user || !isPasswordValid) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // 3. Senha correta! Cria o cookie de sessão
    const cookieStore = await cookies();
    cookieStore.set('provisional_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
    });

    return NextResponse.json({ success: true, role: user.role });
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
