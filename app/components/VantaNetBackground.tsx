'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type VantaEffect = {
  destroy: () => void;
};

type VantaNetOptions = {
  el: HTMLElement;
  THREE?: unknown;
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  scale?: number;
  scaleMobile?: number;
  color?: number;
  backgroundColor?: number;
  points?: number;
  maxDistance?: number;
  spacing?: number;
  showDots?: boolean;
};

declare global {
  interface Window {
    THREE?: unknown;
    VANTA?: {
      NET?: (options: VantaNetOptions) => VantaEffect;
    };
  }
}

type Props = {
  opacity?: number;
  disableOnMobile?: boolean;
};

export default function VantaNetBackground({ opacity = 1, disableOnMobile = false }: Props) {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffectRef = useRef<VantaEffect | null>(null);
  const [threeReady, setThreeReady] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

  useEffect(() => {
    if (window.THREE) setThreeReady(true);
    if (window.VANTA?.NET) setVantaReady(true);
  }, []);

  useEffect(() => {
    if (!threeReady || !vantaReady || !vantaRef.current || vantaEffectRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 520px)').matches;
    if (prefersReducedMotion || (disableOnMobile && isMobile)) return;

    vantaEffectRef.current = window.VANTA?.NET?.({
      el: vantaRef.current,
      THREE: window.THREE,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1,
      color: 0xc49a2a,
      backgroundColor: 0x0f0d0b,
      points: 12,
      maxDistance: 22,
      spacing: 18,
      showDots: true,
    }) ?? null;

    return () => {
      vantaEffectRef.current?.destroy();
      vantaEffectRef.current = null;
    };
  }, [disableOnMobile, threeReady, vantaReady]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeReady(true)}
        onReady={() => setThreeReady(true)}
      />
      {threeReady && (
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js"
          strategy="afterInteractive"
          onLoad={() => setVantaReady(true)}
          onReady={() => setVantaReady(true)}
        />
      )}

      <div
        ref={vantaRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
