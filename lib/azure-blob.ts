const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export type UploadImageOptions = {
  file: File | null;
  folder: 'global-nodes' | 'node-requests' | 'private-nodes' | 'edge-documents';
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeSasToken(value: string): string {
  return value.startsWith('?') ? value.slice(1) : value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function buildBlobName(folder: UploadImageOptions['folder'], extension: string): string {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');

  return `${folder}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export async function uploadNodeImage({ file, folder }: UploadImageOptions): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const extension = ALLOWED_IMAGE_TYPES.get(file.type);
  if (!extension) {
    throw new Error('Formato de imagem invalido. Use JPG, PNG ou WebP.');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Imagem muito grande. O limite e 5 MB.');
  }

  const containerUrl = trimTrailingSlash(requireEnv('AZURE_BLOB_CONTAINER_URL'));
  const sasToken = normalizeSasToken(requireEnv('AZURE_BLOB_SAS_TOKEN'));
  const publicBaseUrl = trimTrailingSlash(
    process.env.AZURE_BLOB_PUBLIC_BASE_URL || containerUrl
  );

  const blobName = buildBlobName(folder, extension);
  const uploadUrl = `${containerUrl}/${blobName}?${sasToken}`;
  const publicUrl = `${publicBaseUrl}/${blobName}`;
  const body = Buffer.from(await file.arrayBuffer());

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version': '2023-11-03',
    },
    body,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('Erro no upload para Azure Blob:', uploadResponse.status, errorText);
    throw new Error('Falha ao enviar imagem para o armazenamento.');
  }

  return publicUrl;
}

export function extractAzureBlobUrlsFromHtml(value?: string | null): string[] {
  if (!value) return [];

  const urls = new Set<string>();
  const imageSrcPattern = /<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/gi;
  let match: RegExpExecArray | null;

  while ((match = imageSrcPattern.exec(value))) {
    if (match[2]) urls.add(match[2]);
  }

  return [...urls];
}

function getBlobNameFromUrl(url: string): string | null {
  const containerUrl = trimTrailingSlash(requireEnv('AZURE_BLOB_CONTAINER_URL'));
  const publicBaseUrl = trimTrailingSlash(
    process.env.AZURE_BLOB_PUBLIC_BASE_URL || containerUrl
  );
  const candidates = [publicBaseUrl, containerUrl];

  for (const baseUrl of candidates) {
    if (!url.startsWith(`${baseUrl}/`)) continue;

    const rawBlobName = url.slice(baseUrl.length + 1).split('?')[0];
    if (!rawBlobName) return null;

    return rawBlobName
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
  }

  return null;
}

export async function deleteAzureBlobByUrl(url?: string | null): Promise<boolean> {
  if (!url) return false;

  const blobName = getBlobNameFromUrl(url);
  if (!blobName) return false;

  const containerUrl = trimTrailingSlash(requireEnv('AZURE_BLOB_CONTAINER_URL'));
  const sasToken = normalizeSasToken(requireEnv('AZURE_BLOB_SAS_TOKEN'));
  const deleteUrl = `${containerUrl}/${blobName}?${sasToken}`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'x-ms-version': '2023-11-03',
    },
  });

  if (response.status === 404) return true;

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro ao deletar blob no Azure:', response.status, errorText);
    return false;
  }

  return true;
}
