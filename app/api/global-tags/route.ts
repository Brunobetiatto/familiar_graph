import { NextResponse } from 'next/server';
import { listGlobalTags } from '@/lib/global-tags-server';

export async function GET() {
  try {
    const tags = await listGlobalTags();
    return NextResponse.json(tags, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar tags globais:', error);
    return NextResponse.json({ error: 'Erro ao buscar tags.' }, { status: 500 });
  }
}
