/** 第 4 區：常用名單（勾選加入、全選、全不選、從名單刪除、改帳號） */
import { loadImage } from '../image';
import { loadRoster, removeFromRoster, renameRosterItem } from '../roster';
import { emit, on, state } from '../state';
import type { RosterItem } from '../types';
import { $, el, emptyItem, setStatus } from './dom';
import { createPerson } from './peoplePanel';

const checked = new Set<string>();

function inUse(item: RosterItem): boolean {
  return state.people.some((p) => p.rosterId === item.id);
}

function updateButtons(): void {
  const n = checked.size;
  const has = state.roster.length > 0;
  $<HTMLButtonElement>('rosterAdd').disabled = n === 0;
  $<HTMLButtonElement>('rosterAdd').textContent = n ? `加入勾選的 ${n} 人` : '加入勾選的人';
  $<HTMLButtonElement>('rosterDelete').disabled = n === 0;
  $<HTMLButtonElement>('rosterAll').disabled = !has;
  $<HTMLButtonElement>('rosterNone').disabled = !has;
  $('rosterCount').textContent = has ? `${state.roster.length} 人` : '';
}

function render(): void {
  // 清掉已經不存在的勾選
  for (const id of checked) if (!state.roster.some((r) => r.id === id)) checked.delete(id);

  const list = $('rosterList');
  list.replaceChildren();
  if (!state.roster.length) {
    list.append(emptyItem('貼過的頭貼會自動存在這裡，下次勾選就能直接加入。'));
    updateButtons();
    return;
  }
  for (const item of state.roster) {
    const box = el('input', { attrs: { type: 'checkbox', 'aria-label': `勾選 ${item.name || '未填帳號'}` } });
    box.checked = checked.has(item.id);
    box.addEventListener('change', () => {
      if (box.checked) checked.add(item.id);
      else checked.delete(item.id);
      updateButtons();
    });

    const name = el('input', {
      attrs: { type: 'text', placeholder: '（未填帳號）', 'aria-label': '名單裡的帳號', 'data-id': item.id, autocomplete: 'off', spellcheck: 'false' },
    });
    name.value = item.name;
    name.addEventListener('change', () => {
      const value = name.value.trim();
      void renameRosterItem(item, value)
        .then(() => {
          // 圖上用到這個人時一起改
          let changed = false;
          for (const p of state.people) {
            if (p.rosterId === item.id) {
              p.name = value;
              changed = true;
            }
          }
          if (changed) emit('people');
        })
        .catch(() => setStatus('帳號沒能存進名單。', 'error'));
    });

    list.append(
      el(
        'label',
        { className: 'item roster-item' },
        box,
        el('img', { attrs: { src: item.url, alt: '' } }),
        name,
        ...(inUse(item) ? [el('span', { className: 'tag', text: '已加入' })] : []),
      ),
    );
  }
  updateButtons();
}

/** 只同步帳號文字，不重建清單（避免吃掉正在進行的點擊） */
function syncNames(): void {
  for (const input of $('rosterList').querySelectorAll<HTMLInputElement>('input[data-id]')) {
    if (document.activeElement === input) continue;
    const item = state.roster.find((r) => r.id === input.dataset.id);
    if (item) input.value = item.name;
  }
}

async function addChecked(): Promise<void> {
  const items = state.roster.filter((r) => checked.has(r.id));
  let added = 0;
  let skipped = 0;
  for (const item of items) {
    if (inUse(item)) {
      skipped++;
      continue;
    }
    try {
      const image = await loadImage(item.url);
      state.people.push(
        createPerson({ name: item.name, image, thumb: URL.createObjectURL(item.avatar), rosterId: item.id }),
      );
      added++;
    } catch {
      /* 壞掉的項目跳過 */
    }
  }
  checked.clear();
  emit('people');
  setStatus(`從名單加入了 ${added} 人。` + (skipped ? `${skipped} 人已經在圖上，略過。` : ''));
}

async function deleteChecked(): Promise<void> {
  const items = state.roster.filter((r) => checked.has(r.id));
  if (!items.length || !confirm(`要從常用名單刪除 ${items.length} 人嗎？（已經在圖上的不受影響）`)) return;
  try {
    await removeFromRoster(items);
  } catch {
    setStatus('刪除失敗，請再試一次。', 'error');
  }
  const ids = new Set(items.map((i) => i.id));
  state.roster = state.roster.filter((r) => !ids.has(r.id));
  for (const p of state.people) if (p.rosterId && ids.has(p.rosterId)) p.rosterId = undefined;
  checked.clear();
  emit('roster');
  setStatus(`已從名單刪除 ${items.length} 人。`);
}

export async function initRosterPanel(): Promise<void> {
  $('rosterAll').addEventListener('click', () => {
    state.roster.forEach((r) => checked.add(r.id));
    render();
  });
  $('rosterNone').addEventListener('click', () => {
    checked.clear();
    render();
  });
  $('rosterAdd').addEventListener('click', () => void addChecked());
  $('rosterDelete').addEventListener('click', () => void deleteChecked());

  on(['roster', 'people'], render);
  on(['rosterNames'], syncNames);

  try {
    state.roster = await loadRoster();
  } catch {
    setStatus('這個瀏覽器無法使用常用名單（可能在私密模式）。', 'error');
  }
  render();
}
