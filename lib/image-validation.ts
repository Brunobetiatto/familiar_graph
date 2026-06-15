const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getImageFileValidationError(file?: File | null): string | null {
  if (!file) return null;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Formato de imagem invalido. Use JPG, PNG ou WebP.';
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Imagem muito grande. O limite e 5 MB.';
  }

  return null;
}
