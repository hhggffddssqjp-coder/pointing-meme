/** 頭貼擷取：從 Threads 留言截圖裁出左邊的圓形頭貼（單則或多則留言的長截圖） */
import { createCanvas } from './image';

/** 長寬比在這個範圍內的圖，視為已經裁好的頭貼 */
const SQUARE_MIN = 0.8;
const SQUARE_MAX = 1.25;

/** 和背景色的 RGB 差距總和超過這個值，就算「有東西」 */
const FG_THRESHOLD = 90;

/** 頭貼在原圖中的正方形範圍 */
export interface AvatarBox {
  x: number;
  y: number;
  size: number;
}


export function isSquareish(width: number, height: number): boolean {
  const ar = width / height;
  return ar > SQUARE_MIN && ar < SQUARE_MAX;
}

/* ---------- 像素存取 ---------- */

interface Pixels {
  w: number;
  h: number;
  on: (x: number, y: number) => boolean;
}

function readPixels(img: HTMLImageElement): Pixels {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const t = createCanvas(w, h);
  const tc = t.getContext('2d', { willReadFrequently: true })!;
  tc.drawImage(img, 0, 0);
  const data = tc.getImageData(0, 0, w, h).data;

  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // 四個角落的中位數當背景色
  const corners = [px(w - 2, 1), px(w - 2, h - 2), px(1, 1), px(1, h - 2)];
  const bg = [0, 1, 2].map((k) => corners.map((c) => c[k]).sort((a, b) => a - b)[1]);

  const on = (x: number, y: number): boolean => {
    const i = (y * w + x) * 4;
    return (
      Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > FG_THRESHOLD
    );
  };
  return { w, h, on };
}

function cropSquare(img: HTMLImageElement, box: AvatarBox): HTMLCanvasElement {
  const c = createCanvas(box.size, box.size);
  c.getContext('2d')!.drawImage(img, box.x, box.y, box.size, box.size, 0, 0, box.size, box.size);
  return c;
}

/* ---------- 單則留言 ---------- */

/**
 * 單則留言截圖的頭貼範圍（原本的 extractAvatar 演算法）：
 * 1. 在左側（寬度最多到高度的 1.2 倍）逐欄計算非背景像素數，找出最左邊、夠寬的連續欄位區段
 * 2. 在這段欄位裡逐列計算，找出最長的連續列範圍
 * 3. 取兩者較短的邊長當正方形
 */
function singleBox({ w, h, on }: Pixels): AvatarBox {
  const lim = Math.min(w, Math.round(h * 1.2));
  const colCount = new Array<number>(lim).fill(0);
  for (let x = 0; x < lim; x++) for (let y = 0; y < h; y++) if (on(x, y)) colCount[x]++;
  const thr = Math.max(6, h * 0.05);
  const minRun = h * 0.18;
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < lim; x++) {
    if (colCount[x] > thr) {
      let e = x;
      while (e + 1 < lim && colCount[e + 1] > thr) e++;
      if (e - x + 1 >= minRun) {
        x0 = x;
        x1 = e;
        break;
      }
      x = e;
    }
  }

  if (x0 < 0) {
    // 找不到就退回取左邊的正方形
    const d = Math.min(h, w);
    return { x: 0, y: (h - d) / 2, size: d };
  }

  const rowCount = new Array<number>(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = x0; x <= x1; x++) if (on(x, y)) rowCount[y]++;
  const thr2 = Math.max(3, (x1 - x0) * 0.05);
  let best: [number, number] = [0, h - 1];
  let bl = 0;
  for (let y = 0; y < h; y++) {
    if (rowCount[y] > thr2) {
      let e = y;
      while (e + 1 < h && rowCount[e + 1] > thr2) e++;
      if (e - y > bl) {
        bl = e - y;
        best = [y, e];
      }
      y = e;
    }
  }
  return { x: x0, y: best[0], size: Math.min(best[1] - best[0] + 1, x1 - x0 + 1) };
}

/* ---------- 多則留言的長截圖 ---------- */

/** 連續區段，允許中間有 maxGap 以內的空隙 */
function runs(values: number[], thr: number, maxGap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= thr) continue;
    if (start >= 0 && i - last - 1 <= maxGap) last = i;
    else {
      if (start >= 0) out.push([start, last]);
      start = last = i;
    }
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

/**
 * 長截圖裡所有頭貼的範圍：
 * 1. 略過橫跨大半寬度的列（分隔線、整排圖片）
 * 2. 找最左邊一段夠密、夠寬的欄位，當作「頭貼欄」
 * 3. 在頭貼欄內逐列計算，每段夠寬的連續列就是一個頭貼（細的串連線會被濾掉）
 * 4. 只留接近正方形、大小和其他頭貼差不多的
 */
function multiBoxes({ w, h, on }: Pixels): AvatarBox[] {
  const skipRow = new Array<boolean>(h).fill(false);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (on(x, y)) n++;
    skipRow[y] = n > w * 0.5;
  }

  // 整張寬度都看（窄的手機截圖頭貼可能佔到一半寬），取最左邊、夠密也夠寬的一段欄位
  const col = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    if (skipRow[y]) continue;
    for (let x = 0; x < w; x++) if (on(x, y)) col[x]++;
  }
  const peak = Math.max(...col);
  const minColW = Math.max(8, w * 0.04);
  // 門檻跟著最密的欄位走，愛心圖示、細線這類稀疏的東西就不會被當成頭貼欄
  const column = runs(col, Math.max(4, h * 0.02, peak * 0.15), 2).find(([a, b]) => b - a + 1 >= minColW);
  if (!column) return [];
  const [ax0, ax1] = column;
  const colW = ax1 - ax0 + 1;

  const rows = new Array<number>(h).fill(0);
  for (let y = 0; y < h; y++) {
    if (skipRow[y]) continue;
    for (let x = ax0; x <= ax1; x++) if (on(x, y)) rows[y]++;
  }

  const boxes: AvatarBox[] = [];
  for (const [y0, y1] of runs(rows, colW * 0.25, Math.max(2, Math.round(colW * 0.15)))) {
    const rh = y1 - y0 + 1;
    if (rh < colW * 0.5 || rh > colW * 1.6) continue;
    let bx0 = ax1;
    let bx1 = ax0;
    for (let y = y0; y <= y1; y++) {
      for (let x = ax0; x <= ax1; x++) {
        if (on(x, y)) {
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
        }
      }
    }
    const bw = bx1 - bx0 + 1;
    if (bw / rh < 0.7 || bw / rh > 1.43) continue;
    const size = Math.min(Math.max(bw, rh), w, h);
    const x = Math.min(w - size, Math.max(0, (bx0 + bx1 + 1) / 2 - size / 2));
    const y = Math.min(h - size, Math.max(0, (y0 + y1 + 1) / 2 - size / 2));
    boxes.push({ x: Math.round(x), y: Math.round(y), size: Math.round(size) });
  }
  if (boxes.length < 2) return boxes;

  const sizes = boxes.map((b) => b.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  return boxes.filter((b) => b.size >= median * 0.75 && b.size <= median * 1.33);
}

/* ---------- 對外 ---------- */

/**
 * 從一張圖取出所有頭貼。
 * - 接近正方形的圖：當作已裁好的頭貼
 * - 找得到 2 個以上頭貼：多則留言的長截圖
 * - 其他：單則留言，用原本的演算法
 */
export function extractAvatars(img: HTMLImageElement): HTMLCanvasElement[] {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  if (isSquareish(w, h)) {
    const d = Math.min(w, h);
    return [cropSquare(img, { x: (w - d) / 2, y: (h - d) / 2, size: d })];
  }

  const p = readPixels(img);
  const many = multiBoxes(p);
  const boxes = many.length >= 2 ? many : [singleBox(p)];
  return boxes.map((box) => cropSquare(img, box));
}

/** 單張頭貼 */
export function extractAvatar(img: HTMLImageElement): HTMLCanvasElement {
  return extractAvatars(img)[0];
}

/** 把正方形頭貼縮放成 size × size */
export function resizeSquare(src: CanvasImageSource, size: number): HTMLCanvasElement {
  const c = createCanvas(size, size);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, size, size);
  return c;
}
