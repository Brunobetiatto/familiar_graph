import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  checkRateLimit,
  getClientIp,
  getPasswordErrors,
  normalizeEmail,
  normalizeName,
  validateEmail,
} from '@/lib/auth-security';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`register:${ip}`, 8, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${rateLimit.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const { email: rawEmail, password, name, confirmPassword, website } = await request.json();
    const email = normalizeEmail(rawEmail);
    const safeName = normalizeName(name);

    if (website) {
      return NextResponse.json({ error: 'Nao foi possivel criar a conta.' }, { status: 400 });
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json({ error: 'As senhas nao conferem.' }, { status: 400 });
    }

    const passwordErrors = getPasswordErrors(password);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'A senha ainda nao atende aos requisitos.', details: passwordErrors },
        { status: 400 }
      );
    }

    // 1. Verifica se o e-mail já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Este e-mail já está em uso.' }, { status: 400 });
    }

    // 2. Criptografa a senha (Salt de 10 rounds é o padrão seguro)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Cria o usuário no banco
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: safeName || email.split('@')[0],
        role: 'USER', // Por padrão, todo mundo nasce como usuário comum
      },
    });

    return NextResponse.json({ message: 'Conta criada com sucesso!' }, { status: 201 });
  } catch (error) {
    console.error('Erro no registro:', error);
    return NextResponse.json({ error: 'Erro interno ao criar conta.' }, { status: 500 });
  }
}
