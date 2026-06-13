import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';
import {
  getPasswordErrors,
  normalizeEmail,
  normalizeName,
  validateEmail,
} from '@/lib/auth-security';

type CreateAdminBody = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = (await request.json()) as CreateAdminBody;
    const email = normalizeEmail(body.email);
    const name = normalizeName(body.name);
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword =
      typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'As senhas nao conferem.' }, { status: 400 });
    }

    const passwordErrors = getPasswordErrors(password);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'A senha ainda nao atende aos requisitos.', details: passwordErrors },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Este e-mail ja esta em uso.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        role: 'ADMIN',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ message: 'Administrador criado com sucesso.', user }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar administrador:', error);
    return NextResponse.json({ error: 'Erro interno ao criar administrador.' }, { status: 500 });
  }
}
