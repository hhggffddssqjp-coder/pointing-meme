/** 底圖與位置：讀取內建的 templates.json、使用者存的底圖，以及位置的共用規則 */
import * as db from './db';
import { canvasToBlob, fitWidth } from './image';
import type { Head, Side, Template } from './types';

/** 每個位置可以縮放的範圍與每按一次的倍率 */
export const HEAD_SCALE_MIN = 0.3;
export const HEAD_SCALE_MAX = 6;
export const HEAD_SCALE_STEP = 1.15;

/** 存進選單的底圖最大寬度，太大的圖會先縮小再存 */
const STORED_MAX_WIDTH = 2000;

const BASE_URL = import.meta.env.BASE_URL;
const TEMPLATE_DIR = `${BASE_URL}templates/`;

/* ---------- 內建底圖（public/templates/templates.json） ---------- */

interface TemplateFileHead {
  x: number;
  y: number;
  side?: Side;
  scale?: number;
}

interface TemplateFileEntry {
  id: string;
  file: string;
  name: string;
  width: number;
  height: number;
  size: number;
  heads: TemplateFileHead[];
}

/** templates.json 用原圖像素座標，比較好手寫；讀進來後轉成 0~1 的相對座標 */
export async function loadBuiltinTemplates(): Promise<Template[]> {
  const res = await fetch(`${TEMPLATE_DIR}templates.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`讀不到 templates.json（HTTP ${res.status}）`);
  const data = (await res.json()) as { templates?: TemplateFileEntry[] };
  return (data.templates ?? []).map((t) => ({
    key: `builtin:${t.id}`,
    source: 'builtin',
    name: t.name,
    src: TEMPLATE_DIR + t.file,
    width: t.width,
    height: t.height,
    size: t.size,
    heads: t.heads.map((h) => ({
      x: h.x / t.width,
      y: h.y / t.height,
      side: h.side === 'L' ? 'L' : 'R',
      scale: h.scale ?? 1,
    })),
  }));
}

/* ---------- 位置 ---------- */

export function cloneHeads(heads: Head[]): Head[] {
  return heads.map((h) => ({ ...h }));
}

/** 新點的位置靠右邊時，問號預設放左邊，免得超出圖 */
export function defaultSide(x: number): Side {
  return x > 0.75 ? 'L' : 'R';
}

/** 上傳的底圖如果和某個已知底圖長寬比幾乎一樣，就當作同一張，直接套用它的位置 */
export function matchByAspect(templates: Template[], width: number, height: number): Template | undefined {
  const ar = width / height;
  return templates.find((t) => Math.abs(t.width / t.height - ar) / ar < 0.015);
}

/* ---------- 使用者底圖（IndexedDB） ---------- */

interface StoredTemplate {
  id: string;
  name: string;
  image: Blob;
  width: number;
  height: number;
  size: number;
  heads: Head[];
  createdAt: number;
}

function toTemplate(r: StoredTemplate): Template {
  return {
    key: `user:${r.id}`,
    source: 'user',
    id: r.id,
    name: r.name,
    src: URL.createObjectURL(r.image),
    width: r.width,
    height: r.height,
    size: r.size,
    heads: r.heads,
  };
}

export async function loadUserTemplates(): Promise<Template[]> {
  const rows = await db.getAll<StoredTemplate>('templates');
  return rows.sort((a, b) => a.createdAt - b.createdAt).map(toTemplate);
}

/** 太大的圖先縮到 STORED_MAX_WIDTH 再存，避免塞爆瀏覽器空間 */
async function prepareImage(image: HTMLImageElement, blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (w <= STORED_MAX_WIDTH && blob.size < 4 * 1024 * 1024) return { blob, width: w, height: h };
  const c = fitWidth(image, w, h, STORED_MAX_WIDTH);
  return { blob: await canvasToBlob(c, 'image/jpeg', 0.9), width: c.width, height: c.height };
}

export async function saveUserTemplate(input: {
  name: string;
  image: HTMLImageElement;
  blob: Blob;
  size: number;
  heads: Head[];
}): Promise<Template> {
  const img = await prepareImage(input.image, input.blob);
  const record: StoredTemplate = {
    id: db.newId(),
    name: input.name,
    image: img.blob,
    width: img.width,
    height: img.height,
    size: input.size,
    heads: cloneHeads(input.heads),
    createdAt: Date.now(),
  };
  await db.put('templates', record);
  return toTemplate(record);
}

/** 覆寫使用者底圖的位置與大小（圖片不變） */
export async function updateUserTemplate(t: Template, heads: Head[], size: number): Promise<void> {
  if (t.source !== 'user' || !t.id) return;
  const rows = await db.getAll<StoredTemplate>('templates');
  const row = rows.find((r) => r.id === t.id);
  if (!row) throw new Error('找不到這張底圖');
  row.heads = cloneHeads(heads);
  row.size = size;
  await db.put('templates', row);
  t.heads = cloneHeads(heads);
  t.size = size;
}

export async function deleteUserTemplate(t: Template): Promise<void> {
  if (t.source !== 'user' || !t.id) return;
  await db.remove('templates', t.id);
  URL.revokeObjectURL(t.src);
}
