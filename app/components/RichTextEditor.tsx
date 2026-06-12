'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type RichTextImageAsset = {
  key: string;
  file: File;
  previewUrl?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  citationTagSlug?: string;
  allowImages?: boolean;
  minHeight?: number;
  imageAssets?: RichTextImageAsset[];
  onImageAssetsChange?: (assets: RichTextImageAsset[]) => void;
};

type CitationType = 'node' | 'edge';

type CitationSearchItem = {
  type: CitationType;
  id: string;
  label: string;
  subtitle: string;
  href: string;
};

type CitationSearchResponse = {
  nodes?: CitationSearchItem[];
  edges?: CitationSearchItem[];
};

type QuillInstance = {
  root: HTMLDivElement;
  on: (eventName: string, callback: (...args: unknown[]) => void) => void;
  getSelection: (focus?: boolean) => { index: number; length: number } | null;
  getText: (index: number, length?: number) => string;
  getLength: () => number;
  setSelection: (index: number, length?: number, source?: string) => void;
  insertEmbed: (index: number, type: string, value: string, source?: string) => void;
  deleteText: (index: number, length: number, source?: string) => void;
  clipboard: {
    dangerouslyPasteHTML(html: string, source?: string): void;
    dangerouslyPasteHTML(index: number, html: string, source?: string): void;
  };
  getModule: (name: string) => { addHandler?: (name: string, callback: () => void) => void };
};

const imageControlButtonStyle: CSSProperties = {
  minWidth: 42,
  height: 30,
  border: '1px solid #3a3020',
  borderRadius: 5,
  background: '#15110d',
  color: '#c8b898',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'sans-serif',
};

function findImageFromTarget(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target instanceof HTMLImageElement) return target;
  return target.closest('img');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  citationTagSlug = 'person',
  allowImages = true,
  minHeight = 300,
  imageAssets = [],
  onImageAssetsChange,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<QuillInstance | null>(null);
  const latestValueRef = useRef(value);
  const imageAssetsRef = useRef(imageAssets);
  const onChangeRef = useRef(onChange);
  const onImageAssetsChangeRef = useRef(onImageAssetsChange);
  const [selectedImageKey, setSelectedImageKey] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionRange, setMentionRange] = useState<{ index: number; length: number } | null>(null);
  const [mentionResults, setMentionResults] = useState<CitationSearchItem[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    imageAssetsRef.current = imageAssets;
  }, [imageAssets]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onImageAssetsChangeRef.current = onImageAssetsChange;
  }, [onImageAssetsChange]);

  useEffect(() => {
    if (!mentionRange || mentionQuery.trim().length < 2) {
      setMentionResults([]);
      setIsMentionLoading(false);
      return;
    }

    let cancelled = false;
    setIsMentionLoading(true);

    const delay = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: mentionQuery.trim(),
          tagSlug: citationTagSlug,
        });
        const response = await fetch(`/api/global-graph/citation-search?${params.toString()}`);

        if (!response.ok) {
          if (!cancelled) setMentionResults([]);
          return;
        }

        const data = (await response.json()) as CitationSearchResponse;
        if (!cancelled) setMentionResults([...(data.nodes ?? []), ...(data.edges ?? [])]);
      } catch (error) {
        console.error('Erro ao buscar mencoes:', error);
        if (!cancelled) setMentionResults([]);
      } finally {
        if (!cancelled) setIsMentionLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(delay);
    };
  }, [citationTagSlug, mentionQuery, mentionRange]);

  useEffect(() => {
    let mounted = true;

    async function setupQuill() {
      if (!editorRef.current || quillRef.current) return;

      const Quill = (await import('quill')).default;
      if (!mounted || !editorRef.current) return;
      const mediaTools = allowImages ? ['link', 'image'] : ['link'];

      const quill = new Quill(editorRef.current, {
        theme: 'snow',
        placeholder,
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }, { background: [] }],
              ['blockquote'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ indent: '-1' }, { indent: '+1' }],
              [{ align: [] }],
              mediaTools,
              ['clean'],
            ],
            handlers: {
              image: () => {
                if (!allowImages) return;
                imageInputRef.current?.click();
              },
            },
          },
        },
      }) as QuillInstance;

      quillRef.current = quill;
      if (latestValueRef.current) {
        quill.clipboard.dangerouslyPasteHTML(latestValueRef.current, 'silent');
      }

      const detectMention = () => {
        const range = quill.getSelection();
        if (!range || range.length > 0) {
          setMentionQuery('');
          setMentionRange(null);
          return;
        }

        const lookBehindLength = Math.min(range.index, 90);
        const lookBehindStart = range.index - lookBehindLength;
        const textBeforeCursor = quill.getText(lookBehindStart, lookBehindLength);
        const match = /(^|[\s([{])@([A-Za-zÀ-ÿ0-9_.\- ]{2,50})$/.exec(textBeforeCursor);

        if (!match) {
          setMentionQuery('');
          setMentionRange(null);
          return;
        }

        const prefixLength = match[1]?.length ?? 0;
        const mentionStart = lookBehindStart + match.index + prefixLength;
        setMentionQuery(match[2].trim());
        setMentionRange({
          index: mentionStart,
          length: range.index - mentionStart,
        });
      };

      quill.on('text-change', () => {
        latestValueRef.current = quill.root.innerHTML;
        onChangeRef.current(quill.root.innerHTML);
        detectMention();
      });

      quill.on('selection-change', () => {
        detectMention();
      });

      quill.root.addEventListener('click', (event) => {
        const image = findImageFromTarget(event.target);
        setSelectedImageKey(image?.dataset.uploadKey ?? null);
      });

      quill.root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          setMentionQuery('');
          setMentionRange(null);
        }
      });

    }

    void setupQuill();

    return () => {
      mounted = false;
    };
  }, [allowImages, placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || quill.root.innerHTML === value) return;

    quill.clipboard.dangerouslyPasteHTML(value || '', 'silent');
  }, [value]);

  useEffect(() => {
    return () => {
      imageAssetsRef.current.forEach((asset) => {
        if (asset.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(asset.previewUrl);
      });
    };
  }, []);

  const emitHtml = () => {
    const quill = quillRef.current;
    if (!quill) return;

    latestValueRef.current = quill.root.innerHTML;
    onChangeRef.current(quill.root.innerHTML);
  };

  const insertImage = async (file: File) => {
    const quill = quillRef.current;
    if (!quill || !allowImages) return;

    const key = crypto.randomUUID();
    const previewUrl = await readFileAsDataUrl(file);
    const range = quill.getSelection(true);
    const index = range?.index ?? Math.max(quill.getLength() - 1, 0);

    quill.insertEmbed(index, 'image', previewUrl, 'user');
    quill.setSelection(index + 1, 0, 'silent');

    window.requestAnimationFrame(() => {
      const image = Array.from(quill.root.querySelectorAll<HTMLImageElement>('img')).find(
        (item) => item.getAttribute('src') === previewUrl && !item.dataset.uploadKey
      );

      if (image) {
        image.dataset.uploadKey = key;
        image.style.width = '70%';
        image.style.maxWidth = '100%';
        image.style.height = 'auto';
        image.style.display = 'block';
        image.style.margin = '14px auto';
        image.style.borderRadius = '8px';
        image.alt = '';
      }

      onImageAssetsChangeRef.current?.([
        ...imageAssetsRef.current,
        { key, file, previewUrl },
      ]);
      setSelectedImageKey(key);
      emitHtml();
    });
  };

  const selectedImage = selectedImageKey
    ? quillRef.current?.root.querySelector<HTMLImageElement>(
        `img[data-upload-key="${selectedImageKey}"]`
      ) ?? null
    : null;

  const updateSelectedImage = (styles: CSSProperties) => {
    if (!selectedImage) return;

    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === undefined || styleValue === null) return;
      selectedImage.style.setProperty(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), String(styleValue));
    });
    emitHtml();
  };

  const removeSelectedImage = () => {
    if (!selectedImage || !selectedImageKey) return;

    const asset = imageAssetsRef.current.find((item) => item.key === selectedImageKey);
    if (asset?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(asset.previewUrl);

    selectedImage.remove();
    onImageAssetsChangeRef.current?.(
      imageAssetsRef.current.filter((item) => item.key !== selectedImageKey)
    );
    setSelectedImageKey(null);
    emitHtml();
  };

  const insertCitation = (citation: CitationSearchItem, replacementRange = mentionRange) => {
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection(true);
    const index = replacementRange?.index ?? range?.index ?? Math.max(quill.getLength() - 1, 0);
    const label = `@${citation.label}`;
    const html = `<a href="${escapeHtml(citation.href)}" data-fg-citation-type="${citation.type}" data-fg-citation-id="${escapeHtml(citation.id)}" title="${escapeHtml(citation.subtitle)}">${escapeHtml(label)}</a>&nbsp;`;

    if (replacementRange) {
      quill.deleteText(replacementRange.index, replacementRange.length, 'user');
    }
    quill.clipboard.dangerouslyPasteHTML(index, html, 'user');
    quill.setSelection(index + label.length + 1, 0, 'silent');
    setMentionQuery('');
    setMentionRange(null);
    setMentionResults([]);

    window.requestAnimationFrame(emitHtml);
  };

  return (
    <div
      className="rich-text-editor"
      style={{ '--rich-text-min-height': `${minHeight}px` } as CSSProperties}
    >
      {allowImages && selectedImage && (
        <div className="rich-text-image-controls">
          <span>Imagem</span>
          {[35, 50, 70, 100].map((width) => (
            <button
              key={width}
              type="button"
              style={imageControlButtonStyle}
              onClick={() => updateSelectedImage({ width: `${width}%`, maxWidth: '100%' })}
            >
              {width}%
            </button>
          ))}
          <button
            type="button"
            style={imageControlButtonStyle}
            onClick={() => updateSelectedImage({ marginLeft: '0', marginRight: 'auto' })}
          >
            Esq
          </button>
          <button
            type="button"
            style={imageControlButtonStyle}
            onClick={() => updateSelectedImage({ marginLeft: 'auto', marginRight: 'auto' })}
          >
            Meio
          </button>
          <button
            type="button"
            style={imageControlButtonStyle}
            onClick={() => updateSelectedImage({ marginLeft: 'auto', marginRight: '0' })}
          >
            Dir
          </button>
          <button
            type="button"
            style={{ ...imageControlButtonStyle, color: '#ff8a8a' }}
            onClick={removeSelectedImage}
          >
            Remover
          </button>
        </div>
      )}

      {mentionRange && (mentionResults.length > 0 || isMentionLoading) && (
        <div className="rich-text-mention-panel">
          {isMentionLoading && <span className="rich-text-mention-loading">Buscando referencias...</span>}
          <div className="rich-text-mention-results">
            {mentionResults.map((citation) => (
              <button
                key={`${citation.type}-${citation.id}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertCitation(citation)}
              >
                <strong>{citation.label}</strong>
                <span>{citation.type === 'node' ? 'Nó' : 'Ligação'} · {citation.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={editorRef} />
      {allowImages && (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void insertImage(file);
            event.target.value = '';
          }}
        />
      )}
    </div>
  );
}
