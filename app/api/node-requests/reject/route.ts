import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { Prisma, User } from '@prisma/client';

interface CookieValue {
  value?: string;
}

interface CookieStore {
  get(name: string): CookieValue | undefined;
}

interface RejectRequestBody {
  requestId: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;

    const user = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const { requestId }: RejectRequestBody = await request.json();

    if (!requestId) {
      return NextResponse.json({ error: 'ID da requisição obrigatório.' }, { status: 400 });
    }

    // Deleta a conexão e a requisição em transação
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.nodeRequestConn.deleteMany({ where: { requestId } });
      await tx.nodeRequest.delete({ where: { id: requestId } });
    });

    return NextResponse.json({ message: 'Solicitação recusada e excluída.' }, { status: 200 });

  } catch (error) {
    console.error('Erro ao recusar requisição:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a recusa.' }, { status: 500 });
  }
}