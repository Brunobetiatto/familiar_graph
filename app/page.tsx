// app/page.tsx
'use client';

import Link from 'next/link';
import styles from './page.module.css';
import VantaNetBackground from '@/app/components/VantaNetBackground';

const showcaseSections = [
  {
    eyebrow: 'Grafo global',
    title: 'Explore conexoes por temas oficiais',
    text: 'Navegue por um grafo compartilhado com busca, filtros por tag e recortes inteligentes de ate 200 nos. O usuario consegue investigar pessoas, eventos, documentos ou qualquer tema criado pelos administradores.',
    imageClass: styles.globalGraphImage,
    imageLabel: 'Tela do grafo global com busca, filtros por tema e nos conectados.',
  },
  {
    eyebrow: 'Solicitacoes',
    title: 'Envie novos nos sem quebrar a curadoria',
    text: 'Qualquer usuario pode sugerir um novo no, adicionar foto, escolher o tema correto e conectar esse no a entidades existentes. A solicitacao entra em revisao antes de aparecer oficialmente no grafo.',
    imageClass: styles.requestImage,
    imageLabel: 'Formulario de solicitacao de novo no com tema, foto e conexoes opcionais.',
  },
  {
    eyebrow: 'Documentos de ligacao',
    title: 'Conte a historia por tras de cada aresta',
    text: 'As ligacoes nao precisam ser apenas uma linha. Cada aresta pode abrir um documento rico com titulo, imagens, texto formatado e contexto historico, funcionando como um artigo dentro do grafo.',
    imageClass: styles.documentImage,
    imageLabel: 'Modal de documento da ligacao com imagem, titulo e conteudo em formato de artigo.',
  },
  {
    eyebrow: 'Detalhes e contexto',
    title: 'Entenda cada no sem sair da visualizacao',
    text: 'Ao selecionar um no, a sidebar mostra biografia, imagem, tema, conexoes e resumos das ligacoes. O usuario pode abrir documentos relacionados ou solicitar novas conexoes a partir dali.',
    imageClass: styles.detailsImage,
    imageLabel: 'Sidebar de detalhes do no com biografia e conexoes relacionadas.',
  },
];

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
            Uma plataforma colaborativa para visualizar relacoes, registrar documentos de ligacao e expandir grafos tematicos com curadoria.
          </p>
          
          <Link href="/global-graph" className={styles.hoverBtn}>
            Acessar a Plataforma
          </Link>
        </div>
      </section>

      {/* ─── TELA 2: Conteúdo Zig-Zag Conectado pelo Grafo ─── */}
      <section className={styles.contentSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>O que existe no projeto</span>
          <h2 className={styles.sectionIntroTitle}>Do mapa visual ao documento completo da relacao</h2>
          <p className={styles.sectionIntroText}>
            A experiencia combina grafo interativo, solicitacoes revisadas por administradores, temas oficiais e documentos ricos para explicar por que cada conexao existe.
          </p>
        </div>

        {showcaseSections.map((section, index) => (
          <div
            key={section.title}
            className={index % 2 === 0 ? styles.zigZagRow : styles.zigZagRowReverse}
          >
            <div className={styles.textContainer}>
              <span className={styles.featureEyebrow}>{section.eyebrow}</span>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionText}>{section.text}</p>
            </div>
            <figure className={styles.showcaseFrame}>
              <div className={`${styles.zigZagImage} ${section.imageClass}`} />
              <figcaption className={styles.imageCaption}>{section.imageLabel}</figcaption>
            </figure>
          </div>
        ))}
      </section>
      
      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <p>© 2026 Familiar Graph. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
