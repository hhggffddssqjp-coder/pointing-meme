/** 下載按鈕：不畫標記，輸出 PNG */
import { canvasToBlob } from '../image';
import { ensureFonts, render, sceneText } from '../render';
import { on, state } from '../state';
import { $, setStatus } from './dom';
import { currentScene } from './stage';

let busy = false;

let downloadsPromise: Promise<ClaudeDownloads | null> | null = null;

function claude(): Promise<ClaudeDownloads | null> {
  downloadsPromise ??= window.claude!.use('downloads').catch(() => null);
  return downloadsPromise;
}

/** 沒辦法直接下載時，把圖秀出來讓使用者長按或右鍵另存 */
function showImage(blob: Blob): void {
  const overlay = $('imageOverlay');
  const img = $<HTMLImageElement>('outImage');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  overlay.hidden = false;
  setStatus('圖片已產生，長按或按右鍵另存。');
}

function filename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `pointing-meme-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}

function refresh(): void {
  $<HTMLButtonElement>('download').disabled = busy || !state.base || !state.heads.length;

  const h = state.heads.length;
  const p = state.people.length;
  let text = '';
  if (state.base) {
    text = `${h} 個位置 · ${p} 個人`;
    if (p > h) text += `，多出的 ${p - h} 人不會出現在圖上`;
    else if (p < h) text += `，有 ${h - p} 個位置空著`;
  }
  $('summary').textContent = text;
}

async function download(): Promise<void> {
  const scene = currentScene();
  if (!scene || busy) return;
  busy = true;
  refresh();
  setStatus('產生圖片中…');
  try {
    await ensureFonts(sceneText(scene));
    const canvas = document.createElement('canvas');
    render(canvas, scene, false);
    const blob = await canvasToBlob(canvas, 'image/png');
    const size = `${canvas.width} × ${canvas.height}`;

    if (window.claude) {
      // 在 Claude Artifact 裡：一般的下載連結會被擋，改用 downloads 能力
      const downloads = await claude();
      if (downloads) {
        try {
          await downloads.save({ filename: filename(), data: blob });
          setStatus(`已下載（${size}）。`);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'declined') setStatus('已取消下載。');
          else if (code === 'rate_limited') setStatus('下載視窗已經開著，請先處理那個視窗。');
          else showImage(blob);
        }
        return;
      }
      showImage(blob);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus(`已下載（${size}）。`);
  } catch {
    setStatus('產生圖片失敗，請再試一次。', 'error');
  } finally {
    busy = false;
    refresh();
  }
}

export function initExportPanel(): void {
  $('download').addEventListener('click', () => void download());
  $('closeImage').addEventListener('click', () => {
    $('imageOverlay').hidden = true;
  });
  // 先把 downloads 能力要好，按下載時就不用等
  if (window.claude) void claude();
  on(['base', 'heads', 'people'], refresh);
  refresh();
}
