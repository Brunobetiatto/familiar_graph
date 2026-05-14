import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ajuste o caminho se a sua pasta lib estiver em outro lugar

// ROTA GET: Busca todos os usuários do banco
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      // Opcional: Você pode incluir dados relacionados logo de cara
      // include: { personTrees: true } 
    });
    
    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json({ error: 'Erro interno ao buscar usuários' }, { status: 500 });
  }
}

// ROTA POST: Cria um novo usuário
export async function POST(request: Request) {
  try {
    // Extrai os dados do corpo da requisição
    const body = await request.json();
    const { email, name, role } = body;

    // Validação básica
    if (!email) {
      return NextResponse.json({ error: 'O campo email é obrigatório' }, { status: 400 });
    }

    // Criação no banco via Prisma
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role, // Se não for enviado, o Prisma usará o default 'USER' definido no schema
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar usuário:", error);
    
    // O Prisma retorna um código específico (P2002) para violação de campos únicos (como o email)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Este email já está em uso.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Erro ao criar o usuário' }, { status: 500 });
  }
}