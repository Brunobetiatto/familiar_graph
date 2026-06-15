import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';
import { AzureBlobError, uploadNodeImage } from '@/lib/azure-blob';

type RouteParams = {
  params: Promise<{ treeId: string }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type PrivateNodePayload = {
  name?: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  photoFile?: File | null;
};

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readPrivateNodePayload(request: Request): Promise<PrivateNodePayload> {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return (await request.json()) as PrivateNodePayload;
  }

  const formData = await request.formData();
  const photo = formData.get('photo');
  const nodeData = parseJsonField(formData.get('nodeData'), {} as PrivateNodePayload);

  return {
    ...nodeData,
    photoFile: photo instanceof File ? photo : null,
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { treeId } = await params;
    const tree = await prisma.personTree.findFirst({
      where: { id: treeId, userId: user.id },
      select: { id: true },
    });

    if (!tree) return NextResponse.json({ error: 'Grafo não encontrado.' }, { status: 404 });

    const body = await readPrivateNodePayload(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'O nome do nó é obrigatório.' }, { status: 400 });
    }

    const uploadedPhotoUrl = await uploadNodeImage({
      file: body.photoFile ?? null,
      folder: 'private-nodes',
    });

    const node = await prisma.personNode.create({
      data: {
        treeId,
        name,
        gender: body.gender || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        deathDate: body.deathDate ? new Date(body.deathDate) : null,
        bio: body.bio || null,
        photoUrl: uploadedPhotoUrl || body.photoUrl || null,
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error: unknown) {
    console.error('Erro ao criar nó privado:', error);
    if (error instanceof AzureBlobError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error, 'Erro interno ao criar nó.') }, { status: 500 });
  }
}
