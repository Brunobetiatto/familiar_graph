'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getImageFileValidationError } from '@/lib/image-validation';

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
  getLine: (index: number) => [{ domNode?: Node; length?: () => number } | null, number];
  format: (name: string, value: unknown, source?: string) => void;
  setSelection: (
    indexOrRange: number | { index: number; length: number },
    lengthOrSource?: number | string,
    source?: string
  ) => void;
  insertEmbed: (index: number, type: string, value: string, source?: string) => void;
  deleteText: (index: number, length: number, source?: string) => void;
  clipboard: {
    dangerouslyPasteHTML(html: string, source?: string): void;
    dangerouslyPasteHTML(index: number, html: string, source?: string): void;
  };
  getModule: (name: string) => unknown;
};

type TableBlot = {
  domNode?: Node;
};

type TableModule = {
  deleteColumn: () => void;
  deleteRow: () => void;
  deleteTable: () => void;
  getTable: (
    range?: { index: number; length: number } | null
  ) => [TableBlot | null, TableBlot | null, TableBlot | null, number];
  insertColumnLeft: () => void;
  insertColumnRight: () => void;
  insertRowAbove: () => void;
  insertRowBelow: () => void;
  insertTable: (rows: number, columns: number) => void;
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
  const [, setImageControlVersion] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionRange, setMentionRange] = useState<{ index: number; length: number } | null>(null);
  const [mentionResults, setMentionResults] = useState<CitationSearchItem[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isTableSelection, setIsTableSelection] = useState(false);

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
              [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }, { background: [] }],
              ['blockquote'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ indent: '-1' }, { indent: '+1' }],
              [{ align: [] }],
              ['table'],
              mediaTools,
              ['clean'],
            ],
            handlers: {
              image: () => {
                if (!allowImages) return;
                imageInputRef.current?.click();
              },
              table: () => {
                const tableModule = quill.getModule('table') as TableModule | null;
                tableModule?.insertTable(3, 3);
                window.requestAnimationFrame(() => {
                  setIsTableSelection(true);
                  emitHtml();
                });
              },
            },
          },
          table: true,
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
        const tableModule = quill.getModule('table') as TableModule | null;
        const range = quill.getSelection();
        const [, , cell] = tableModule?.getTable(range) ?? [null, null, null, -1];
        setIsTableSelection(Boolean(cell));
        detectMention();
      });

      quill.root.addEventListener('click', (event) => {
        const image = findImageFromTarget(event.target);
        setSelectedImageKey(image?.dataset.uploadKey ?? null);
        setImageControlVersion((current) => current + 1);
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

    const validationError = getImageFileValidationError(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    setImageError('');

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
        image.style.width = '46%';
        image.style.maxWidth = '100%';
        image.style.height = 'auto';
        image.style.display = 'inline-block';
        image.style.verticalAlign = 'top';
        image.style.margin = '8px';
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
  const selectedImageWidth = selectedImage
    ? Number.parseInt(selectedImage.style.width || '70', 10) || 70
    : 70;
  const selectedImageHeightValue = selectedImage?.style.height && selectedImage.style.height !== 'auto'
    ? Number.parseInt(selectedImage.style.height, 10) || 240
    : 240;
  const selectedImageUsesAutoHeight = !selectedImage?.style.height || selectedImage.style.height === 'auto';

  const updateSelectedImage = (styles: CSSProperties) => {
    if (!selectedImage) return;

    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === undefined || styleValue === null) return;
      selectedImage.style.setProperty(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), String(styleValue));
    });
    setImageControlVersion((current) => current + 1);
    emitHtml();
  };

  const updateSelectedImageWidth = (width: number) => {
    const safeWidth = Math.max(10, Math.min(100, Math.round(width)));
    updateSelectedImage({ width: `${safeWidth}%`, maxWidth: '100%' });
  };

  const updateSelectedImageHeight = (height: number) => {
    const safeHeight = Math.max(40, Math.min(900, Math.round(height)));
    updateSelectedImage({ height: `${safeHeight}px`, objectFit: 'cover' });
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

  const getTableModule = (): TableModule | null => {
    const quill = quillRef.current;
    if (!quill) return null;
    return quill.getModule('table') as TableModule | null;
  };

  const updateTableSelectionState = () => {
    const tableModule = getTableModule();
    const quill = quillRef.current;
    if (!tableModule || !quill) {
      setIsTableSelection(false);
      return;
    }

    const [, , cell] = tableModule.getTable(quill.getSelection());
    setIsTableSelection(Boolean(cell));
  };

  const insertTable = (rows: number, columns: number) => {
    const tableModule = getTableModule();
    tableModule?.insertTable(rows, columns);
    window.requestAnimationFrame(() => {
      updateTableSelectionState();
      emitHtml();
    });
  };

  const runTableAction = (action: keyof Omit<TableModule, 'getTable' | 'insertTable'>) => {
    const tableModule = getTableModule();
    tableModule?.[action]();
    window.requestAnimationFrame(() => {
      updateTableSelectionState();
      emitHtml();
    });
  };

  const getCurrentTableElements = () => {
    const tableModule = getTableModule();
    const quill = quillRef.current;
    if (!tableModule || !quill) return { table: null, cell: null };

    const [tableBlot, , cellBlot] = tableModule.getTable(quill.getSelection(true));
    const cell =
      cellBlot?.domNode instanceof HTMLElement
        ? cellBlot.domNode
        : null;
    const table =
      tableBlot?.domNode instanceof HTMLElement
        ? tableBlot.domNode
        : cell?.closest('table') ?? null;

    return { table, cell };
  };

  const updateCurrentTable = (styles: CSSProperties) => {
    const { table } = getCurrentTableElements();
    if (!table) return;

    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === undefined || styleValue === null) return;
      table.style.setProperty(
        key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(styleValue)
      );
    });
    emitHtml();
  };

  const updateCurrentCell = (styles: CSSProperties) => {
    const { cell } = getCurrentTableElements();
    if (!cell) return;

    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === undefined || styleValue === null) return;
      cell.style.setProperty(
        key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(styleValue)
      );
    });
    emitHtml();
  };

  const applyCurrentBlockStyles = (styles: CSSProperties) => {
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection(true);
    const [line] = quill.getLine(range?.index ?? Math.max(quill.getLength() - 1, 0));
    const node = line?.domNode;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    if (!element) return;

    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === undefined || styleValue === null) return;
      element.style.setProperty(
        key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(styleValue)
      );
    });
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
      <div className="rich-text-format-controls">
        <span>Texto</span>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ lineHeight: '1.35', marginTop: '0', marginBottom: '6px' })}
        >
          Compacto
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ lineHeight: '1.7', marginTop: '0', marginBottom: '12px' })}
        >
          Normal
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ lineHeight: '2', marginTop: '0', marginBottom: '18px' })}
        >
          Aberto
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ textAlign: 'left' })}
        >
          Esq
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ textAlign: 'center' })}
        >
          Centro
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCurrentBlockStyles({ textAlign: 'right' })}
        >
          Dir
        </button>
      </div>

      <div className="rich-text-table-controls">
        <div className="rich-text-table-controls-header">
          <span>Tabela</span>
          <div>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertTable(2, 2)}
            >
              2x2
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertTable(3, 3)}
            >
              3x3
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertTable(4, 4)}
            >
              4x4
            </button>
          </div>
        </div>

        {isTableSelection && (
          <div className="rich-text-table-control-grid">
            <div className="rich-text-table-control-group">
              <span>Estrutura</span>
              <div>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('insertRowAbove')}>
                  Linha acima
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('insertRowBelow')}>
                  Linha abaixo
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('insertColumnLeft')}>
                  Coluna esq.
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('insertColumnRight')}>
                  Coluna dir.
                </button>
              </div>
            </div>

            <div className="rich-text-table-control-group">
              <span>Remover</span>
              <div>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('deleteRow')}>
                  Linha
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('deleteColumn')}>
                  Coluna
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableAction('deleteTable')}>
                  Tabela
                </button>
              </div>
            </div>

            <div className="rich-text-table-control-group">
              <span>Layout</span>
              <div>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => updateCurrentTable({ width: '100%', marginLeft: '0', marginRight: '0' })}>
                  100%
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => updateCurrentTable({ width: '80%', marginLeft: 'auto', marginRight: 'auto' })}>
                  Centro
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => updateCurrentTable({ width: '60%', marginLeft: 'auto', marginRight: 'auto' })}>
                  Compacta
                </button>
              </div>
            </div>

            <div className="rich-text-table-control-group">
              <span>Celula</span>
              <div>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCurrentBlockStyles({ textAlign: 'left' })}>
                  Esq
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCurrentBlockStyles({ textAlign: 'center' })}>
                  Centro
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => updateCurrentCell({ backgroundColor: 'rgba(196, 154, 42, 0.12)' })}>
                  Fundo
                </button>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => updateCurrentCell({ backgroundColor: 'transparent' })}>
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {allowImages && selectedImage && (
        <div className="rich-text-image-controls">
          <div className="rich-text-image-controls-header">
            <span>Imagem selecionada</span>
            <button type="button" className="rich-text-image-remove" onClick={removeSelectedImage}>
              Remover
            </button>
          </div>

          <div className="rich-text-image-control-grid">
            <div className="rich-text-image-control-group">
              <span>Tamanho</span>
              <div className="rich-text-image-axis-controls">
                <label className="rich-text-image-axis-control">
                  <span>Horizontal</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={selectedImageWidth}
                    aria-label="Largura horizontal da imagem em porcentagem"
                    onChange={(event) => updateSelectedImageWidth(Number(event.target.value))}
                  />
                  <small>{selectedImageWidth}%</small>
                </label>

                <label className="rich-text-image-axis-control">
                  <span>Vertical</span>
                  <input
                    type="range"
                    min="40"
                    max="900"
                    step="10"
                    value={selectedImageHeightValue}
                    aria-label="Altura vertical da imagem em pixels"
                    disabled={selectedImageUsesAutoHeight}
                    onChange={(event) => updateSelectedImageHeight(Number(event.target.value))}
                  />
                  <small>{selectedImageUsesAutoHeight ? 'Auto' : `${selectedImageHeightValue}px`}</small>
                </label>

                <div className="rich-text-image-axis-buttons">
                  <button
                    type="button"
                    onClick={() => updateSelectedImage({ height: 'auto', objectFit: 'contain' })}
                  >
                    Altura auto
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedImageHeight(selectedImageHeightValue)}
                  >
                    Altura manual
                  </button>
                </div>
              </div>
            </div>

            <div className="rich-text-image-control-group">
              <span>Alinhamento</span>
              <div>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Alinhar imagem à esquerda"
                  aria-label="Alinhar imagem à esquerda"
                  onClick={() => updateSelectedImage({ marginLeft: '0', marginRight: 'auto' })}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Centralizar imagem"
                  aria-label="Centralizar imagem"
                  onClick={() => updateSelectedImage({ marginLeft: 'auto', marginRight: 'auto' })}
                >
                  ↔
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Alinhar imagem à direita"
                  aria-label="Alinhar imagem à direita"
                  onClick={() => updateSelectedImage({ marginLeft: 'auto', marginRight: '0' })}
                >
                  →
                </button>
              </div>
            </div>

            <div className="rich-text-image-control-group">
              <span>Fluxo</span>
              <div>
                <button
                  type="button"
                  title="Permitir imagem ao lado de outra"
                  aria-label="Permitir imagem ao lado de outra"
                  onClick={() => updateSelectedImage({ display: 'inline-block', verticalAlign: 'top', margin: '8px' })}
                >
                  Em linha
                </button>
                <button
                  type="button"
                  title="Imagem em linha propria"
                  aria-label="Imagem em linha propria"
                  onClick={() => updateSelectedImage({ display: 'block', marginLeft: 'auto', marginRight: 'auto' })}
                >
                  Bloco
                </button>
              </div>
            </div>

            <div className="rich-text-image-control-group">
              <span>Espaçamento</span>
              <div>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Espaçamento compacto"
                  aria-label="Espaçamento compacto"
                  onClick={() => updateSelectedImage({ marginTop: '6px', marginBottom: '6px' })}
                >
                  ↕−
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Espaçamento normal"
                  aria-label="Espaçamento normal"
                  onClick={() => updateSelectedImage({ marginTop: '14px', marginBottom: '14px' })}
                >
                  ↕
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Espaçamento amplo"
                  aria-label="Espaçamento amplo"
                  onClick={() => updateSelectedImage({ marginTop: '24px', marginBottom: '24px' })}
                >
                  ↕+
                </button>
              </div>
            </div>

            <div className="rich-text-image-control-group">
              <span>Borda</span>
              <div>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Imagem com canto reto"
                  aria-label="Imagem com canto reto"
                  onClick={() => updateSelectedImage({ borderRadius: '0' })}
                >
                  □
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Imagem com canto suave"
                  aria-label="Imagem com canto suave"
                  onClick={() => updateSelectedImage({ borderRadius: '8px' })}
                >
                  ▢
                </button>
                <button
                  type="button"
                  className="rich-text-image-icon-button"
                  title="Imagem mais arredondada"
                  aria-label="Imagem mais arredondada"
                  onClick={() => updateSelectedImage({ borderRadius: '16px' })}
                >
                  ○
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {imageError && <p className="rich-text-image-error">{imageError}</p>}

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
