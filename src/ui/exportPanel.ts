/** 下載按鈕：不畫標記，輸出 PNG */
import { canvasToBlob } from '../image';
import { ensureFonts, render, sceneText } from '../render';
import { on, state } from '../state';
import { $, setStatus } from './dom';
import { currentScene } from './stage';

let busy = false;

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus(`已下載（${canvas.width} × ${canvas.height}）。`);
  } catch {
    setStatus('產生圖片失敗，請再試一次。', 'error');
  } finally {
    busy = false;
    refresh();
  }
}

export function initExportPanel(): void {
  $('download').addEventListener('click', () => void download());
  on(['base', 'heads', 'people'], refresh);
  refresh();
}
