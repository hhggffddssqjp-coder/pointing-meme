/** 第 3 區：留言的人（上傳／貼上截圖、填帳號、上移、刪除、打亂） */
import { avatarHash, extractAvatars, isSameAvatar } from '../avatar';
import { loadImageFromBlob } from '../image';
import { addToRoster, makeRosterAvatar, renameRosterItem } from '../roster';
import { emit, on, state } from '../state';
import type { Person } from '../types';
import { $, button, el, emptyItem, setStatus } from './dom';

let uid = 0;

export function createPerson(fields: Omit<Person, 'id'>): Person {
  return { id: ++uid, ...fields };
}

export function removePerson(index: number): void {
  const [p] = state.people.splice(index, 1);
  if (p?.thumb) URL.revokeObjectURL(p.thumb);
}

/** 截圖 → 裁頭貼（長截圖可能有很多個）→ 加到清單，並自動存進常用名單 */
async function addFromFiles(files: File[]): Promise<void> {
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  setStatus('處理截圖中…');
  let added = 0;
  let saved = 0;
  let broken = 0;
  let dupes = 0;
  let fromRoster = 0;
  for (const f of images) {
    let avatars: HTMLCanvasElement[];
    try {
      const { image, url } = await loadImageFromBlob(f);
      URL.revokeObjectURL(url);
      avatars = extractAvatars(image);
    } catch {
      broken++;
      continue;
    }
    for (const avatar of avatars) {
      const hash = avatarHash(avatar);
      // 圖上已經有這個人：略過
      if (state.people.some((p) => isSameAvatar(p.hash, hash))) {
        dupes++;
        continue;
      }
      const small = await makeRosterAvatar(avatar);
      const person = createPerson({ name: '', image: avatar, thumb: URL.createObjectURL(small), hash });
      // 常用名單裡已經有這個人：沿用那筆（帳號也一起帶進來），不另存一筆
      const known = state.roster.find((r) => isSameAvatar(r.hash, hash));
      if (known) {
        person.name = known.name;
        person.rosterId = known.id;
        fromRoster++;
      } else {
        try {
          const item = await addToRoster(small, '', hash);
          state.roster.push(item);
          person.rosterId = item.id;
          saved++;
        } catch {
          /* 名單存不進去不影響這次使用 */
        }
      }
      state.people.push(person);
      added++;
    }
  }
  const dupeText = dupes ? `略過 ${dupes} 個圖上已經有的重複頭貼。` : '';
  if (!added) {
    if (dupes) setStatus(dupeText);
    else setStatus('這些圖片打不開，請換一張試試。', 'error');
    return;
  }
  emit('people', 'roster');
  setStatus(
    `從 ${images.length - broken} 張圖加入了 ${added} 個頭貼` +
      (fromRoster ? `（其中 ${fromRoster} 個是常用名單裡的人，帳號已帶入）` : '') +
      '。' +
      dupeText +
      (saved + fromRoster < added ? '有些沒能存進常用名單。' : '') +
      (broken ? `另有 ${broken} 張打不開。` : ''),
  );
}

/** 把截圖檔拖到網頁任何地方就加入 */
function initDragDrop(): void {
  const overlay = $('dropOverlay');
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const hide = () => {
    depth = 0;
    overlay.hidden = true;
  };

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) overlay.hidden = true;
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    hide();
    void addFromFiles([...e.dataTransfer!.files]);
  });
}

function render(): void {
  const list = $('peopleList');
  list.replaceChildren();
  if (!state.people.length) {
    list.append(emptyItem('還沒有人。貼上留言截圖，或從常用名單勾選加入。'));
    return;
  }
  state.people.forEach((p, i) => {
    const n = i + 1;
    const avatar = p.thumb
      ? el('img', { attrs: { src: p.thumb, alt: '' } })
      : el('span', { className: 'ph', text: '?', attrs: { 'aria-hidden': 'true' } });

    const input = el('input', {
      attrs: { type: 'text', placeholder: '帳號', 'aria-label': `第 ${n} 位的帳號`, autocomplete: 'off', spellcheck: 'false' },
    });
    input.value = p.name;
    input.addEventListener('input', () => {
      p.name = input.value;
      emit('names');
    });
    // 離開輸入框時，把帳號同步到常用名單
    input.addEventListener('change', () => {
      const item = state.roster.find((r) => r.id === p.rosterId);
      if (item && item.name !== p.name.trim()) {
        void renameRosterItem(item, p.name.trim())
          .then(() => emit('rosterNames'))
          .catch(() => setStatus('常用名單的帳號沒能更新。', 'error'));
      }
    });

    list.append(
      el(
        'div',
        { className: 'item' },
        el('span', { className: 'n', text: String(n) }),
        avatar,
        input,
        el(
          'span',
          { className: 'actions-inline' },
          button(
            '上移',
            () => {
              [state.people[i - 1], state.people[i]] = [state.people[i], state.people[i - 1]];
              emit('people');
            },
            { label: `第 ${n} 位上移`, disabled: i === 0 },
          ),
          button(
            '刪除',
            () => {
              removePerson(i);
              emit('people');
            },
            { label: `從圖上移除第 ${n} 位` },
          ),
        ),
      ),
    );
  });
}

export function initPeoplePanel(): void {
  const file = $<HTMLInputElement>('peopleFiles');
  file.addEventListener('change', async () => {
    const files = [...(file.files ?? [])];
    file.value = '';
    await addFromFiles(files);
  });

  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.items ?? [])]
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (!files.length) return;
    e.preventDefault();
    void addFromFiles(files);
  });

  $('addBlank').addEventListener('click', () => {
    state.people.push(createPerson({ name: '', image: null, thumb: null }));
    emit('people');
    const inputs = $('peopleList').querySelectorAll('input');
    inputs[inputs.length - 1]?.focus();
  });

  $('shuffle').addEventListener('click', () => {
    const a = state.people;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    emit('people');
  });

  initDragDrop();
  on(['people'], render);
  render();
}
