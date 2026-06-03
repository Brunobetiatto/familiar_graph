import Link from 'next/link';
import styles from './graph-choice.module.css';

export const metadata = {
  title: 'Escolha seu Grafo',
  description: 'Escolha entre criar um grafo privado ou acessar o grafo global.',
};

export default function GraphChoicePage() {
  return (
    <main className={styles.page}>
      <div className={styles.starryBackground} />
      <div className={styles.radialGlow} />

      <section className={styles.shell} aria-labelledby="graph-choice-title">
        <Link href="/" className={styles.backLink}>
          Voltar para a home
        </Link>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>Escolha o próximo nó</p>
          <h1 id="graph-choice-title" className={styles.title}>
            Qual grafo você quer explorar?
          </h1>
          <p className={styles.description}>
            Uma rota nasce privada, feita para construir conexões próprias. A outra abre o mapa
            colaborativo global do Familiar Graph.
          </p>
        </div>

        <div className={styles.choiceStage}>
          <div className={styles.decisionLine} aria-hidden="true">
            <span className={styles.linePulse} />
          </div>
          <div className={styles.centerNode} aria-hidden="true" />

          <article className={`${styles.choiceNode} ${styles.privateNode}`}>
            <span className={styles.nodeHalo} aria-hidden="true" />
            <div className={styles.nodeCore}>
              <span className={styles.statusBadge}>Em progresso</span>
              <h2>Grafo privado</h2>
              <p>
                Crie um espaço reservado para mapear sua própria rede, organizar relações e
                evoluir conexões antes de publicar.
              </p>
              <button className={styles.disabledButton} type="button" disabled>
                Criar grafo privado
              </button>
            </div>
          </article>

          <Link href="/global-graph" className={`${styles.choiceNode} ${styles.globalNode}`}>
            <span className={styles.nodeHalo} aria-hidden="true" />
            <div className={styles.nodeCore}>
              <span className={styles.statusBadge}>Disponível agora</span>
              <h2>Grafo global</h2>
              <p>
                Entre no mapa compartilhado, navegue por pessoas e descubra como cada conexão
                amplia a rede principal.
              </p>
              <span className={styles.primaryButton}>Escolher grafo global</span>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
