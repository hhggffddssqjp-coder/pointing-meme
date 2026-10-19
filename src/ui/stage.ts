/** 預覽畫布：畫圖、點一下新增位置、拖曳移動 */
import { ensureFonts, render, sceneText, type Scene } from '../render';
import { emit, on, state } from '../state';
import { defaultSide } from '../templates';
import { $ } from './dom';

const canvas = () => $<HTMLCanvasElement>('canvas');

export function currentScene(): Scene | null {
  if (!state.base) return null;
  return { base: state.base, heads: state.heads, people: state.people, size: state.size, style: state.style };
}

let scheduled = false;

/** 合併同一個畫格內的重畫要求，並且先等字型載入 */
export function requestDraw(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(async () => {
    const scene = currentScene();
    if (scene) await ensureFonts(sceneText(scene));
    scheduled = false;
    const latest = currentScene();
    if (latest) render(canvas(), latest, state.style.showMarks);
  });
}

export function setEmptyMessage(title: string, text = ''): void {
  $('emptyTitle').textContent = title;
  $('emptyText').textContent = text;
}

function refreshVisibility(): void {
  const has = !!state.base;
  $('empty').hidden = has;
  canvas().hidden = !has;
  $('hint').hidden = !has;
}

export function initStage(): void {
  const cv = canvas();
  let dragging = -1;

  const pos = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height };
  };

  cv.addEventListener('pointerdown', (e) => {
    if (!state.base || e.button !== 0) return;
    e.preventDefault();
    const p = pos(e);
    const rad = ((state.size / 100) * p.w) / 2;

    // 點到既有的位置就拖它，否則新增一個
    let hit = -1;
    let best = Infinity;
    state.heads.forEach((h, i) => {
      const d = Math.hypot((h.x - p.x) * p.w, (h.y - p.y) * p.h);
      if (d < rad * h.scale && d < best) {
        best = d;
        hit = i;
      }
    });
    if (hit < 0) {
      state.heads.push({ x: p.x, y: p.y, side: defaultSide(p.x), scale: 1 });
      hit = state.heads.length - 1;
      emit('heads');
    }
    dragging = hit;
    cv.setPointerCapture(e.pointerId);
  });

  cv.addEventListener('pointermove', (e) => {
    if (dragging < 0) return;
    const p = pos(e);
    const h = state.heads[dragging];
    h.x = Math.min(1, Math.max(0, p.x));
    h.y = Math.min(1, Math.max(0, p.y));
    requestDraw();
  });

  const stop = () => {
    dragging = -1;
  };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);

  on(['base'], refreshVisibility);
  on(['base', 'heads', 'people', 'names', 'style'], requestDraw);

  // 字型比逾時還晚到時，補畫一次
  if ('fonts' in document) document.fonts.addEventListener('loadingdone', requestDraw);

  refreshVisibility();
}
