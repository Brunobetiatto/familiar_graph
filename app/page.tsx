// app/page.tsx
'use client';

import Link from 'next/link';
import styles from './page.module.css';
import VantaNetBackground from '@/app/components/VantaNetBackground';

export default function HomePage() {
  return (
    <div className={styles.container}>
      <VantaNetBackground opacity={0.72} />
      
      {/* ─── A Textura de Fundo do Grafo ─── */}
      <div className={styles.starryBackground} />
      
      {/* ─── O Fio Base do Grafo e o Pulso Viajante (Começa no Zig-Zag) ─── */}
      <div className={styles.globalWireContainer}>
        {/* O Fio Base semi-transparente */}
        <div className={styles.globalWireBase} />
        {/* A Pulsação (Onda de energia viajando no fio) */}
        <div className={styles.globalWirePulse} />
      </div>
      
      {/* ─── TELA 1: Hero Section (A luz nasce aqui) ─── */}
      <section className={styles.heroSection}>

        {/* Círculo Gigante com Fade perfeito - A LUZ DO CENTRO */}
        <div className={styles.glowingCircle} />

        {/* Conteúdo Central (Título, Descrição e Botão) */}
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Familiar Graph
          </h1>
          <p className={styles.heroDescription}>
            Mapeie conexões invisíveis. O Familiar Graph é uma plataforma colaborativa projetada para visualizar e expandir redes sociais, profissionais e genealógicas em um ambiente global único.
          </p>
          
          <Link href="/graph-choice" className={styles.hoverBtn}>
            Acessar a Plataforma
          </Link>
        </div>
      </section>

      {/* ─── TELA 2: Conteúdo Zig-Zag Conectado pelo Grafo ─── */}
      <section className={styles.contentSection}>
        
        {/* Bloco 1: Texto à Esquerda, Imagem à Direita */}
        <div className={styles.zigZagRow}>
          <div className={styles.textContainer}>
            <h2 className={styles.sectionTitle}>Construa Redes Globais</h2>
            <p className={styles.sectionText}>
              Vá muito além da genealogia tradicional. Conecte amigos, colegas de equipe, mentores e parceiros. Cada novo membro adicionado expande o mapa vivo de interações.
            </p>
          </div>
          <div className={`${styles.zigZagImage} ${styles.img1}`} />
        </div>

        {/* Bloco 2: Imagem à Esquerda, Texto à Direita (row-reverse) */}
        <div className={styles.zigZagRowReverse}>
          <div className={styles.textContainer}>
            <h2 className={styles.sectionTitle}>Curadoria Segura</h2>
            <p className={styles.sectionText}>
              Todas as novas conexões passam por um painel exclusivo de análise. Administradores garantem a integridade dos dados, revisando cada nó antes que ele faça parte do grafo oficial.
            </p>
          </div>
          <div className={`${styles.zigZagImage} ${styles.img2}`} />
        </div>

        {/* Bloco 3: Texto à Esquerda, Imagem à Direita */}
        <div className={styles.zigZagRow}>
          <div className={styles.textContainer}>
            <h2 className={styles.sectionTitle}>Visualização de Dados Avançada</h2>
            <p className={styles.sectionText}>
              Navegue por uma interface imersiva. Dê zoom, arraste a tela e descubra instantaneamente como um único ponto pode influenciar dezenas de outros ao longo da história.
            </p>
          </div>
          <div className={`${styles.zigZagImage} ${styles.img3}`} />
        </div>
      </section>
      
      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <p>© 2026 Familiar Graph. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
