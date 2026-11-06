/**
 * Thought bubbles above people's heads: a symbol for what they need or do.
 * Plain DOM elements positioned over the canvas (crisp on every screen).
 */
import * as THREE from 'three';
import type { Person } from '../sim/life/types';

const CHAT: Record<string, string> = { talk: '💬', flirt: '❤️', love: '❤️', quarrel: '😠', play: '🤸', comfort: '🤗' };

/** A symbol for what someone needs, feels or does right now (null: nothing to say). */
export function bubbleSymbol(p: Person, t: number): string | null {
  if (!p.alive) return null;
  if (p.action === 'carried') return '✨';
  if (p.goal === 'safety') return '😱';
  if (p.chat) return CHAT[p.chat.kind] ?? '💬';
  if (p.awe !== undefined) return '😮';
  if (p.action === 'sleep') return '💤';
  if (p.sick > 0) return '🤒';
  if (p.action === 'drink') return '💧';
  if (p.goal === 'water' || p.thirst > 0.8) return '💧';
  if (p.action === 'gather') return '🫐';
  if (p.goal === 'food' || p.hunger > 0.8) return '🍖';
  // Feelings show now and then, not all the time.
  const now = Math.floor(t / 120 + p.id) % 3 === 0;
  if (now && p.moods.some((m) => m.key === 'grief' && m.v <= -15 && m.until > t)) return '😢';
  if (now && p.feel?.kind === 'fear') return '😨';
  if (now && p.feel?.kind === 'anger') return '😠';
  if (now && p.luck !== undefined) return '🍀';
  if (now && p.pregnant) return '🤰';
  return null;
}

export interface BubbleItem {
  id: number;
  pos: THREE.Vector3;
  symbol: string | null;
  label?: string;
  selected: boolean;
}

export class BubbleLayer {
  private readonly root: HTMLDivElement;
  private readonly nodes = new Map<number, HTMLDivElement>();
  private readonly v = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'bubbles';
    this.root.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  clear(): void {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
  }

  update(items: BubbleItem[], camera: THREE.PerspectiveCamera, width: number, height: number, cameraDistance: number): void {
    const keep = new Set<number>();
    const showAll = cameraDistance < 22;
    for (const item of items) {
      if (!item.selected && (!showAll || !item.symbol)) continue;
      // Hidden behind the planet?
      this.toCam.subVectors(camera.position, item.pos);
      const up = this.up.copy(item.pos).normalize();
      if (this.toCam.dot(up) < -0.2 * this.toCam.length()) continue;
      const head = this.v.copy(item.pos).addScaledVector(up, 0.45).project(camera);
      if (head.z > 1 || head.x < -1.1 || head.x > 1.1 || head.y < -1.1 || head.y > 1.1) continue;
      keep.add(item.id);
      let node = this.nodes.get(item.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'bubble';
        this.root.appendChild(node);
        this.nodes.set(item.id, node);
      }
      const text = item.label ? `${item.symbol ? item.symbol + ' ' : ''}${item.label}` : item.symbol ?? '';
      if (node.textContent !== text) node.textContent = text;
      node.classList.toggle('is-selected', item.selected);
      node.classList.toggle('is-label', !!item.label);
      const x = ((head.x + 1) / 2) * width;
      const y = ((1 - head.y) / 2) * height;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    for (const [id, node] of this.nodes) {
      if (!keep.has(id)) {
        node.remove();
        this.nodes.delete(id);
      }
    }
  }
}
