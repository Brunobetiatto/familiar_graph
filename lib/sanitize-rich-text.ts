const EMPTY_HTML_PATTERN = /^(<br\s*\/?>|\s|&nbsp;)*$/i;

export function sanitizeRichText(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || EMPTY_HTML_PATTERN.test(trimmed)) return null;

  return trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s+data-upload-key\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, '')
    .replace(/\s+src\s*=\s*(['"])\s*blob:[\s\S]*?\1/gi, '');
}
