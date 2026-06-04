'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import styles from './PersonNode.module.css';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PersonNodeData = {
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  bio: string | null;
  photoUrl: string | null;
  tagSlug: string;
  tagLabel: string;
  tagColor: string;
};

export type PersonNodeType = Node<PersonNodeData, 'personNode'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GENDER_SYMBOL: Record<string, string> = {
  MALE: '♂',
  FEMALE: '♀',
  OTHER: '⚥',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function formatYear(iso: string | null): string | null {
  if (!iso) return null;
  return String(new Date(iso).getFullYear());
}

// ─── Componente ───────────────────────────────────────────────────────────────

function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const birthYear = formatYear(data.birthDate);
  const deathYear = formatYear(data.deathDate);

  let lifespan: string | null = null;
  if (birthYear && deathYear) lifespan = `${birthYear} – ${deathYear}`;
  else if (birthYear) lifespan = `n. ${birthYear}`;
  else if (deathYear) lifespan = `† ${deathYear}`;

  return (
    <>
      {/* Handle invisível no topo (recebe arestas de pais) */}
     {/* Target Handle: Onde as linhas chegam */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'transparent', border: 'none', top: -5 }} 
      />

      <div
        className={`${styles.nodeContainer} ${selected ? styles.nodeContainerSelected : ''}`}
        style={
          {
            '--tag-primary': data.tagColor,
          } as React.CSSProperties
        }
      >
        <div className={styles.tagRail} />
        {/* Avatar */}
        <div
          className={`${styles.avatar} ${selected ? styles.avatarSelected : ''}`}
          style={{
            // A imagem de fundo fica inline porque é dinâmica (vem do banco)
            backgroundImage: data.photoUrl ? `url(${data.photoUrl})` : 'none',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {!data.photoUrl && getInitials(data.name)}
        </div>

        {/* Informações */}
        <div className={styles.infoContainer}>
          <div className={styles.name}>
            {data.name}
          </div>

          <div className={styles.metaContainer}>
            <span className={styles.tagLabel}>{data.tagLabel}</span>
            {lifespan && (
              <span className={styles.lifespan}>{lifespan}</span>
            )}
            {data.gender && (
              <span className={styles.gender}>
                {GENDER_SYMBOL[data.gender]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Handle invisível na base (origina arestas para filhos) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'transparent', border: 'none', bottom: -5 }}
      />
    </>
  );
}

export default memo(PersonNode);
