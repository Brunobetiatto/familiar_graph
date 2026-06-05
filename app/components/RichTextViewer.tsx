'use client';

import { useEffect, useRef } from 'react';

type Props = {
  value: string;
};

type QuillViewerInstance = {
  root: HTMLDivElement;
  enable: (enabled: boolean) => void;
};

export default function RichTextViewer({ value }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<QuillViewerInstance | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setupQuillViewer() {
      if (!containerRef.current || quillRef.current) return;

      const Quill = (await import('quill')).default;
      if (!mounted || !containerRef.current) return;

      const quill = new Quill(containerRef.current, {
        theme: 'snow',
        readOnly: true,
        modules: {
          toolbar: false,
        },
      }) as QuillViewerInstance;

      quill.enable(false);
      quill.root.innerHTML = value;
      quillRef.current = quill;
    }

    void setupQuillViewer();

    return () => {
      mounted = false;
    };
  }, [value]);

  useEffect(() => {
    if (!quillRef.current) return;
    quillRef.current.root.innerHTML = value;
  }, [value]);

  return <div className="rich-text-viewer" ref={containerRef} />;
}
