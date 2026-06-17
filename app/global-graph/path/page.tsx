import Link from 'next/link';
import RichTextViewer from '@/app/components/RichTextViewer';
import { getGlobalGraphPath } from '@/lib/global-graph-path';
import styles from './path.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ligacao direta',
  description: 'Caminho narrativo entre dois nos do grafo global.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
}

export default async function GlobalGraphPathPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const from = readParam(params, 'from');
  const to = readParam(params, 'to');
  const tagSlug = readParam(params, 'tagSlug');
  const result = await getGlobalGraphPath({ fromId: from, toId: to, tagSlug });
  const theme = result.activeTag.theme;

  return (
    <main
      className={styles.page}
      style={
        {
          '--path-bg': theme.background,
          '--path-surface': theme.surface,
          '--path-border': theme.border,
          '--path-primary': theme.primary,
          '--path-secondary': theme.secondary,
          '--path-muted': theme.muted,
        } as React.CSSProperties
      }
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href={`/global-graph?tagSlug=${result.activeTag.slug}`} className={styles.backLink}>
            Voltar ao grafo
          </Link>
          <span className={styles.tagPill}>{result.activeTag.label}</span>
          <h1>Ligacao direta</h1>
          <p>
            {result.fromNode && result.toNode
              ? `${result.fromNode.name} ate ${result.toNode.name}`
              : 'Escolha dois nos no grafo global para montar o caminho.'}
          </p>
        </header>

        {!from || !to ? (
          <section className={styles.emptyState}>
            <h2>Nenhum caminho selecionado</h2>
            <p>Abra o mini menu ao lado da busca no grafo global e escolha dois nos.</p>
          </section>
        ) : !result.found ? (
          <section className={styles.emptyState}>
            <h2>Caminho nao encontrado</h2>
            <p>
              Nao existe uma sequencia de ligacoes entre esses dois nos dentro do tema atual.
            </p>
          </section>
        ) : (
          <section className={styles.timeline} aria-label="Caminho entre os nos">
            {result.steps.map((step, index) => {
              const birthDate = formatDate(step.node.birthDate);
              const deathDate = formatDate(step.node.deathDate);
              const hasEdgeDocument =
                step.edgeToNext?.description ||
                step.edgeToNext?.documentTitle ||
                step.edgeToNext?.documentImageUrl ||
                step.edgeToNext?.documentContent;

              return (
                <article key={`${step.node.id}-${index}`} className={styles.step}>
                  <div className={styles.nodeCard}>
                    <div
                      className={styles.avatar}
                      style={{
                        backgroundImage: step.node.photoUrl ? `url(${step.node.photoUrl})` : undefined,
                      }}
                    >
                      {!step.node.photoUrl && getInitials(step.node.name)}
                    </div>
                    <div className={styles.nodeContent}>
                      <span className={styles.stepLabel}>No {index + 1}</span>
                      <h2>{step.node.name}</h2>
                      <div className={styles.nodeMeta}>
                        <span>{step.node.tagLabel}</span>
                        {birthDate && <span>{step.node.fieldLabels.birthDate}: {birthDate}</span>}
                        {deathDate && <span>{step.node.fieldLabels.deathDate}: {deathDate}</span>}
                      </div>
                      {step.node.bio && (
                        <div className={styles.nodeBio}>
                          <RichTextViewer value={step.node.bio} />
                        </div>
                      )}
                    </div>
                  </div>

                  {step.edgeToNext && step.nextNode && (
                    <div className={styles.edgeDocument}>
                      <div className={styles.connectorLine} aria-hidden="true" />
                      <div className={styles.edgeCard}>
                        <div className={styles.edgeHeader}>
                          <span>{step.edgeToNext.relation}</span>
                          <small>{step.edgeToNext.directionLabel}</small>
                        </div>
                        <h3>
                          {step.edgeToNext.documentTitle ||
                            `${step.node.name} para ${step.nextNode.name}`}
                        </h3>
                        {step.edgeToNext.documentImageUrl && (
                          <img src={step.edgeToNext.documentImageUrl} alt="" className={styles.edgeImage} />
                        )}
                        {step.edgeToNext.description && (
                          <p className={styles.edgeDescription}>{step.edgeToNext.description}</p>
                        )}
                        {step.edgeToNext.documentContent ? (
                          <div className={styles.richText}>
                            <RichTextViewer value={step.edgeToNext.documentContent} />
                          </div>
                        ) : !hasEdgeDocument ? (
                          <p className={styles.noDocument}>Sem documento registrado para esta ligacao.</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
