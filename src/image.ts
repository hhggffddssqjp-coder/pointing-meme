/** 圖片載入與 canvas 的共用小工具 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖片：${src}`));
    img.src = src;
  });
}

/** 從檔案或 Blob 載入圖片，回傳圖片和它的 object URL（呼叫端負責 revoke） */
export async function loadImageFromBlob(blob: Blob): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  try {
    return { image: await loadImage(url), url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法輸出圖片'))), type, quality);
  });
}

/** 把一張圖等比縮放到指定寬度以內 */
export function fitWidth(src: CanvasImageSource, width: number, height: number, maxWidth: number): HTMLCanvasElement {
  const k = Math.min(1, maxWidth / width);
  const c = createCanvas(width * k, height * k);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
