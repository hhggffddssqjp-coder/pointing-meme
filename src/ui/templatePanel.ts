/** 第 1 區：底圖下拉選單、上傳、存進選單、更新位置、刪除 */
import { loadImage, loadImageFromBlob } from '../image';
import { readPref, writePref } from '../prefs';
import { emit, on, state, UPLOAD_KEY } from '../state';
import {
  cloneHeads,
  deleteUserTemplate,
  loadBuiltinTemplates,
  loadUserTemplates,
  matchByAspect,
  saveUserTemplate,
  updateUserTemplate,
} from '../templates';
import type { BaseImage, Head, Template } from '../types';
import { $, el, setStatus } from './dom';
import { setEmptyMessage } from './stage';

const select = () => $<HTMLSelectElement>('templateSelect');

/** 每次換底圖都加一；圖片載入完時若已經不是最新的要求，就丟掉結果 */
let loadSeq = 0;

function activeTemplate(): Template | undefined {
  return state.templates.find((t) => t.key === state.activeKey);
}

function renderSelect(): void {
  const s = select();
  s.replaceChildren();
  const builtin = state.templates.filter((t) => t.source === 'builtin');
  const user = state.templates.filter((t) => t.source === 'user');

  if (!state.activeKey) s.append(el('option', { text: '— 請選擇底圖 —', attrs: { value: '' } }));
  const option = (t: Template) => el('option', { text: `${t.name}（${t.heads.length} 人）`, attrs: { value: t.key } });
  if (builtin.length) s.append(el('optgroup', { attrs: { label: '內建' } }, ...builtin.map(option)));
  if (user.length) s.append(el('optgroup', { attrs: { label: '我存的底圖' } }, ...user.map(option)));
  if (state.activeKey === UPLOAD_KEY) {
    s.append(el('option', { text: '上傳的底圖（尚未存進選單）', attrs: { value: UPLOAD_KEY } }));
  }
  s.value = state.activeKey ?? '';

  const t = activeTemplate();
  $<HTMLButtonElement>('saveTemplate').disabled = !state.base;
  $('updateTemplate').hidden = t?.source !== 'user';
  $('deleteTemplate').hidden = t?.source !== 'user';
}

function setBase(base: BaseImage, heads: Head[], size: number, key: string): void {
  // 上一張上傳但沒存的底圖用不到了
  const prev = state.base;
  if (prev && state.activeKey === UPLOAD_KEY && prev.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
  state.base = base;
  state.heads = cloneHeads(heads);
  state.size = size;
  state.activeKey = key;
  emit('base', 'heads', 'style', 'templates');
}

async function applyTemplate(t: Template): Promise<void> {
  const seq = ++loadSeq;
  try {
    const image = await loadImage(t.src);
    if (seq !== loadSeq) return;
    setBase({ image, url: t.src, width: image.naturalWidth, height: image.naturalHeight }, t.heads, t.size, t.key);
    writePref('lastTemplate', t.key);
  } catch {
    if (seq !== loadSeq) return;
    state.base = null;
    state.activeKey = t.key;
    emit('base', 'templates');
    const file = t.src.split('/').pop();
    setEmptyMessage(
      `找不到「${t.name}」的圖片`,
      t.source === 'builtin' ? `請把圖片放到 public/templates/${file}，或改選其他底圖。` : '請改選其他底圖。',
    );
    setStatus(`找不到「${t.name}」的底圖圖片。`, 'error');
  }
}

async function onUpload(file: File): Promise<void> {
  const seq = ++loadSeq;
  try {
    const { image, url } = await loadImageFromBlob(file);
    if (seq !== loadSeq) {
      URL.revokeObjectURL(url);
      return;
    }
    const match = matchByAspect(state.templates, image.naturalWidth, image.naturalHeight);
    setBase(
      { image, url, width: image.naturalWidth, height: image.naturalHeight, blob: file },
      match ? match.heads : [],
      match ? match.size : state.size,
      UPLOAD_KEY,
    );
    setStatus(
      match
        ? `看起來是「${match.name}」，已自動放好 ${match.heads.length} 個位置，有偏差可以拖曳調整。`
        : '底圖已放好，接著在圖上點出每個人的頭。',
    );
  } catch {
    setStatus('這張圖片打不開，請換一張試試。', 'error');
  }
}

async function onSave(): Promise<void> {
  const base = state.base;
  if (!base) return;
  const name = prompt('底圖名稱', `${state.heads.length} 人版`)?.trim();
  if (!name) return;
  try {
    setStatus('儲存中…');
    const blob = base.blob ?? (await (await fetch(base.url)).blob());
    const t = await saveUserTemplate({ name, image: base.image, blob, size: state.size, heads: state.heads });
    if (state.activeKey === UPLOAD_KEY) URL.revokeObjectURL(base.url);
    state.templates.push(t);
    // 換成存起來的那份圖，之後就不依賴上傳時的暫時網址
    state.base = { ...base, url: t.src, blob: undefined };
    state.activeKey = t.key;
    writePref('lastTemplate', t.key);
    emit('templates');
    setStatus(`「${name}」已存進底圖選單（存在這個瀏覽器裡）。`);
  } catch {
    setStatus('存不進去：可能是瀏覽器空間不足或在私密模式。', 'error');
  }
}

async function onUpdate(): Promise<void> {
  const t = activeTemplate();
  if (!t) return;
  try {
    await updateUserTemplate(t, state.heads, state.size);
    emit('templates');
    setStatus(`已更新「${t.name}」的位置與大小。`);
  } catch {
    setStatus('更新失敗，請再試一次。', 'error');
  }
}

async function onDelete(): Promise<void> {
  const t = activeTemplate();
  if (!t || t.source !== 'user') return;
  if (!confirm(`要從選單刪除「${t.name}」嗎？`)) return;
  try {
    await deleteUserTemplate(t);
    state.templates = state.templates.filter((x) => x !== t);
    const next = state.templates[0];
    if (next) await applyTemplate(next);
    else {
      state.base = null;
      state.activeKey = null;
      emit('base', 'templates');
    }
    setStatus(`已刪除「${t.name}」。`);
  } catch {
    setStatus('刪除失敗，請再試一次。', 'error');
  }
}

export async function initTemplatePanel(): Promise<void> {
  on(['templates', 'base', 'heads'], renderSelect);

  select().addEventListener('change', () => {
    const t = state.templates.find((x) => x.key === select().value);
    if (t) void applyTemplate(t).then(() => state.base && setStatus(`已套用「${t.name}」。`));
  });

  const file = $<HTMLInputElement>('baseFile');
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (f) await onUpload(f);
  });

  $('saveTemplate').addEventListener('click', () => void onSave());
  $('updateTemplate').addEventListener('click', () => void onUpdate());
  $('deleteTemplate').addEventListener('click', () => void onDelete());

  // 讀取選單內容
  let builtin: Template[] = [];
  let user: Template[] = [];
  try {
    builtin = await loadBuiltinTemplates();
  } catch {
    setStatus('讀不到 templates/templates.json，內建底圖無法使用。', 'error');
  }
  try {
    user = await loadUserTemplates();
  } catch {
    /* 沒有 IndexedDB 時就只有內建底圖 */
  }
  state.templates = [...builtin, ...user];

  const last = readPref<string | null>('lastTemplate', null);
  const initial = state.templates.find((t) => t.key === last) ?? state.templates[0];
  // 載入期間使用者已經自己上傳了底圖，就不要蓋掉
  if (loadSeq > 0) renderSelect();
  else if (initial) await applyTemplate(initial);
  else {
    setEmptyMessage('先放一張梗圖底圖', '從右邊的第 1 步上傳');
    renderSelect();
  }
}
