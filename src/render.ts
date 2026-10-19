/** 繪圖：把底圖、頭貼、問號、帳號和位置標記畫到 canvas 上 */
import type { BaseImage, Head, Person, StyleOptions } from './types';

/** 輸出圖片的最小寬度；底圖比這小時會等比放大 */
export const MIN_OUTPUT_WIDTH = 1400;

export const FONT_FAMILY = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const FONT_WEIGHT = 900;
const FONT_LOAD_TIMEOUT = 4000;

const MARK_COLOR = '#D93A2B';
const PLACEHOLDER_BG = '#d9dcef';
const PLACEHOLDER_INK = '#5d6285';

export interface Scene {
  base: BaseImage;
  heads: Head[];
  people: Person[];
  size: number;
  style: StyleOptions;
}

export function outputSize(width: number, height: number): { width: number; height: number; scale: number } {
  const scale = Math.max(1, MIN_OUTPUT_WIDTH / width);
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

/** 帳號顯示文字：去掉使用者自己打的 @，再依設定加回來 */
export function formatName(name: string, withAt: boolean): string {
  const clean = name.trim().replace(/^@+/, '');
  return clean ? (withAt ? '@' : '') + clean : '';
}

/** 畫面上會用到的所有文字，給字型預先載入用 */
export function sceneText(scene: Scene): string {
  return '?0123456789@' + scene.people.map((p) => p.name).join('');
}

/* ---------- 字型 ---------- */

const loadedChars = new Set<string>();

/**
 * 等 Noto Sans TC 載入完成。Google Fonts 的中文字型依字元分片下載，
 * 所以每次有新字元（例如新帳號）都要再要一次對應的分片。
 * 網路太慢時最多等 FONT_LOAD_TIMEOUT，之後字型到了會再觸發重畫。
 */
export async function ensureFonts(text: string): Promise<void> {
  if (!('fonts' in document)) return;
  const missing = [...new Set(text)].filter((ch) => !loadedChars.has(ch)).join('');
  if (!missing) return;
  const load = Promise.all([
    document.fonts.ready,
    document.fonts.load(`${FONT_WEIGHT} 32px "Noto Sans TC"`, missing),
  ]).catch(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, FONT_LOAD_TIMEOUT))]);
  for (const ch of missing) loadedChars.add(ch);
}

function font(px: number): string {
  return `${FONT_WEIGHT} ${px}px ${FONT_FAMILY}`;
}

/* ---------- 繪圖 ---------- */

export function render(target: HTMLCanvasElement, scene: Scene, marks: boolean): void {
  const { base, heads, people, size, style } = scene;
  const { width: W, height: H, scale: sc } = outputSize(base.width, base.height);
  if (target.width !== W) target.width = W;
  if (target.height !== H) target.height = H;

  const g = target.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.drawImage(base.image, 0, 0, W, H);

  const D0 = (size / 100) * W;
  heads.forEach((hd, i) => {
    const cx = hd.x * W;
    const cy = hd.y * H;
    const D = D0 * hd.scale;
    const p = people[i];
    if (p) {
      drawAvatar(g, p, cx, cy, D);
      if (style.showQuestion) drawQuestion(g, cx, cy, D, hd.side, style.questionColor);
      if (style.showName) drawName(g, formatName(p.name, style.withAt), cx, cy, D, sc);
    }
    if (marks) drawMarker(g, i + 1, cx, cy, D, sc);
  });
}

/** 圓形遮罩貼上頭貼；沒有頭貼時畫灰底問號 */
function drawAvatar(g: CanvasRenderingContext2D, p: Person, cx: number, cy: number, D: number): void {
  g.save();
  g.beginPath();
  g.arc(cx, cy, D / 2, 0, Math.PI * 2);
  g.closePath();
  if (p.image) {
    g.clip();
    // 小頭貼放大時用比較平滑的插值，減少鋸齒和馬賽克感
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(p.image, cx - D / 2, cy - D / 2, D, D);
  } else {
    g.fillStyle = PLACEHOLDER_BG;
    g.fill();
    g.fillStyle = PLACEHOLDER_INK;
    g.font = font(D * 0.5);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, cy);
  }
  g.restore();
}

function drawQuestion(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  D: number,
  side: Head['side'],
  color: string,
): void {
  const fs = D * 0.62;
  const right = side !== 'L';
  const qx = right ? cx + D / 2 + D * 0.06 : cx - D / 2 - D * 0.06;
  const qy = cy - D * 0.28;
  g.save();
  g.font = font(fs);
  g.textBaseline = 'middle';
  g.textAlign = right ? 'left' : 'right';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, fs * 0.12);
  g.strokeStyle = '#000';
  g.fillStyle = color;
  g.strokeText('?', qx, qy);
  g.fillText('?', qx, qy);
  g.restore();
}

function drawName(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, D: number, sc: number): void {
  if (!text) return;
  const fs = Math.max(12 * sc, D * 0.18);
  const ty = cy + D / 2 + D * 0.04;
  g.save();
  g.font = font(fs);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, fs * 0.28);
  g.strokeStyle = '#000';
  g.fillStyle = '#fff';
  g.strokeText(text, cx, ty);
  g.fillText(text, cx, ty);
  g.restore();
}

/** 編輯用的虛線圓圈和編號，匯出時不畫 */
function drawMarker(g: CanvasRenderingContext2D, n: number, cx: number, cy: number, D: number, sc: number): void {
  g.save();
  g.setLineDash([D * 0.08, D * 0.06]);
  g.lineWidth = Math.max(2, D * 0.03);
  g.strokeStyle = '#fff';
  g.beginPath();
  g.arc(cx, cy, D / 2, 0, Math.PI * 2);
  g.stroke();

  g.setLineDash([]);
  const r = Math.max(11 * sc, D * 0.14);
  const bx = cx - D / 2 + r * 0.6;
  const by = cy - D / 2 + r * 0.6;
  g.fillStyle = MARK_COLOR;
  g.beginPath();
  g.arc(bx, by, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fff';
  g.stroke();
  g.fillStyle = '#fff';
  g.font = font(r * 1.2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), bx, by + r * 0.05);
  g.restore();
}
