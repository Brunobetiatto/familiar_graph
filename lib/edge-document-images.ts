import { uploadNodeImage } from '@/lib/azure-blob';

export type DocumentImageMeta = {
  key: string;
};

type UploadInlineDocumentImagesOptions = {
  content?: string | null;
  images?: DocumentImageMeta[] | null;
  filesByKey: Record<string, File>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceImageTagSource(tag: string, imageKey: string, imageUrl: string): string {
  const withoutUploadKey = tag.replace(
    new RegExp(`\\sdata-upload-key=(["'])${escapeRegExp(imageKey)}\\1`, 'i'),
    ''
  );

  const withoutSrcSet = withoutUploadKey.replace(/\ssrcset=(["']).*?\1/i, '');

  if (/\ssrc=(["']).*?\1/i.test(withoutSrcSet)) {
    return withoutSrcSet.replace(/\ssrc=(["']).*?\1/i, ` src="${imageUrl}"`);
  }

  return withoutSrcSet.replace(/<img\b/i, `<img src="${imageUrl}"`);
}

function removePendingImage(content: string, imageKey: string): string {
  const imagePattern = new RegExp(
    `<img\\b(?=[^>]*\\bdata-upload-key=(["'])${escapeRegExp(imageKey)}\\1)[^>]*>`,
    'gi'
  );

  return content.replace(imagePattern, '');
}

export async function uploadInlineDocumentImages({
  content,
  images,
  filesByKey,
}: UploadInlineDocumentImagesOptions): Promise<string | null> {
  if (!content) return null;

  let nextContent = content;

  for (const image of images ?? []) {
    const file = filesByKey[image.key];
    if (!file) {
      nextContent = removePendingImage(nextContent, image.key);
      continue;
    }

    const imageUrl = await uploadNodeImage({
      file,
      folder: 'edge-documents',
    });

    if (!imageUrl) {
      nextContent = removePendingImage(nextContent, image.key);
      continue;
    }

    const imagePattern = new RegExp(
      `<img\\b(?=[^>]*\\bdata-upload-key=(["'])${escapeRegExp(image.key)}\\1)[^>]*>`,
      'gi'
    );

    nextContent = nextContent.replace(imagePattern, (tag) =>
      replaceImageTagSource(tag, image.key, imageUrl)
    );
  }

  return nextContent;
}
