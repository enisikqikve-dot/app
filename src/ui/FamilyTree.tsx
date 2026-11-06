import { useEffect, useRef } from 'preact/hooks';
import { formatNumber, t } from '../i18n';
import type { FamilyTree, TreeNode } from '../game/peopleInfo';
import { HAIR_COLORS } from '../sim/life/types';
import { IconClose } from './icons';

interface Props {
  tree: FamilyTree;
  onFocus: (id: number) => void;
  onOpen: (id: number) => void;
  onClose: () => void;
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function Node({ node, focus, onFocus, onOpen }: { node: TreeNode | null; focus?: boolean; onFocus: (id: number) => void; onOpen: (id: number) => void }) {
  if (!node) return <div class="tree-node is-unknown">{t('tree.unknown')}</div>;
  const years = node.diedYear !== null ? t('tree.years', { from: formatNumber(node.bornYear), to: formatNumber(node.diedYear) }) : t('tree.since', { from: formatNumber(node.bornYear) });
  return (
    <div class={`tree-node is-${node.sex}${node.alive ? '' : ' is-dead'}${focus ? ' is-focus' : ''}`}>
      <button type="button" class="tree-name" onClick={() => (focus ? onOpen(node.id) : onFocus(node.id))}>
        <span class="tree-hair" style={{ background: hex(HAIR_COLORS[node.hair] ?? 0) }} aria-hidden="true" />
        {node.name}
        {!node.alive && ' †'}
      </button>
      <span class="tree-years mono">{years}</span>
      {focus && (
        <button type="button" class="btn small" onClick={() => onOpen(node.id)}>
          {t('tree.open')}
        </button>
      )}
    </div>
  );
}

function Row({ label, nodes, onFocus, onOpen }: { label: string; nodes: (TreeNode | null)[]; onFocus: (id: number) => void; onOpen: (id: number) => void }) {
  if (nodes.every((n) => n === null)) return null;
  return (
    <div class="tree-row">
      <h3>{label}</h3>
      <div class="tree-nodes">
        {nodes.map((n, i) => (
          <Node key={n ? n.id : `u${i}`} node={n} onFocus={onFocus} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/** Three generations around one person; tap a name to move through the family. */
export function FamilyTreeView({ tree, onFocus, onOpen, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <section class="tree glass-strong" aria-labelledby="tree-title">
      <div class="place-head">
        <h2 id="tree-title" class="panel-title">
          {t('tree.title')}
        </h2>
        <button ref={closeRef} type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <div class="tree-body">
        <Row label={t('tree.grandparents')} nodes={tree.grandparents} onFocus={onFocus} onOpen={onOpen} />
        <Row label={t('tree.parents')} nodes={tree.parents} onFocus={onFocus} onOpen={onOpen} />
        <div class="tree-row is-center">
          <div class="tree-nodes">
            <Node node={tree.focus} focus onFocus={onFocus} onOpen={onOpen} />
            {tree.partners.map((n) => (
              <Node key={n.id} node={n} onFocus={onFocus} onOpen={onOpen} />
            ))}
          </div>
        </div>
        {tree.siblings.length > 0 && <Row label={t('tree.siblings')} nodes={tree.siblings} onFocus={onFocus} onOpen={onOpen} />}
        {tree.children.length > 0 && <Row label={t('tree.children')} nodes={tree.children} onFocus={onFocus} onOpen={onOpen} />}
        {tree.grandchildren > 0 && <p class="note">{t('tree.grandchildren', { n: formatNumber(tree.grandchildren) })}</p>}
      </div>
      <p class="note">{t('tree.note')}</p>
    </section>
  );
}
