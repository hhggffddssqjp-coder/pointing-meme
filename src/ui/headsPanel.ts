/** 第 2 區：頭的位置清單（放大、縮小、問號左右、刪除）與標記開關 */
import { pixelWidth } from '../image';
import { formatName, outputSize } from '../render';
import { emit, on, state } from '../state';
import { HEAD_SCALE_MAX, HEAD_SCALE_MIN, HEAD_SCALE_STEP } from '../templates';
import { askConfirm } from './dialog';
import { $, button, el, emptyItem } from './dom';

/** 頭貼的像素連輸出大小的一半都不到，放大後就會明顯糊掉 */
const BLURRY_RATIO = 0.5;

function label(i: number): string {
  const p = state.people[i];
  if (!p) return '空著';
  return formatName(p.name, true) || '（沒填帳號）';
}

function isBlurry(i: number): boolean {
  const p = state.people[i];
  if (!p?.image || !state.base) return false;
  const outW = outputSize(state.base.width, state.base.height).width;
  const needed = (state.size / 100) * outW * state.heads[i].scale;
  return pixelWidth(p.image) < needed * BLURRY_RATIO;
}

function render(): void {
  const list = $('headList');
  list.replaceChildren();
  if (!state.heads.length) {
    list.append(emptyItem(state.base ? '還沒有位置，點左邊的圖新增。' : '先選一張底圖。'));
    return;
  }
  state.heads.forEach((hd, i) => {
    const n = i + 1;
    const scale = Math.abs(hd.scale - 1) > 0.01 ? ` · ${hd.scale.toFixed(2)}×` : '';
    const zoom = (k: number) => () => {
      hd.scale = Math.min(HEAD_SCALE_MAX, Math.max(HEAD_SCALE_MIN, hd.scale * k));
      emit('heads');
    };
    list.append(
      el(
        'div',
        { className: 'item' },
        el('span', { className: 'n', text: String(n) }),
        el(
          'span',
          { className: 'grow', text: label(i) + scale },
          ...(isBlurry(i)
            ? [
                el('span', {
                  className: 'tag warn',
                  text: '頭貼太小，會糊',
                  attrs: { title: '換一張頭貼比較大的截圖（例如放大網頁後再截），或把這個位置縮小' },
                }),
              ]
            : []),
        ),
        el(
          'span',
          { className: 'actions-inline' },
          button('放大', zoom(HEAD_SCALE_STEP), { label: `放大位置 ${n}` }),
          button('縮小', zoom(1 / HEAD_SCALE_STEP), { label: `縮小位置 ${n}` }),
          button(
            hd.side === 'L' ? '問號在左' : '問號在右',
            () => {
              hd.side = hd.side === 'L' ? 'R' : 'L';
              emit('heads');
            },
            { label: `切換位置 ${n} 的問號方向` },
          ),
          button(
            '刪除',
            () => {
              state.heads.splice(i, 1);
              emit('heads');
            },
            { label: `刪除位置 ${n}` },
          ),
        ),
      ),
    );
  });
}

export function initHeadsPanel(): void {
  const marks = $<HTMLInputElement>('showMarks');
  marks.checked = state.style.showMarks;
  marks.addEventListener('change', () => {
    state.style.showMarks = marks.checked;
    emit('style');
  });

  $('clearHeads').addEventListener('click', async () => {
    if (!state.heads.length || !(await askConfirm('要清除全部位置嗎？', '清除'))) return;
    state.heads = [];
    emit('heads');
  });

  on(['heads', 'people', 'names', 'base', 'style'], render);
  render();
}
