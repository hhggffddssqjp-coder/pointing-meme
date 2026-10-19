/** 介面用的小工具 */

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`找不到元素 #${id}`);
  return node as T;
}

interface ElProps {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

export function button(
  text: string,
  onClick: () => void,
  opts: { label?: string; disabled?: boolean; className?: string } = {},
): HTMLButtonElement {
  const b = el('button', { className: opts.className ?? 'small', text, attrs: { type: 'button' } });
  if (opts.label) b.setAttribute('aria-label', opts.label);
  b.disabled = !!opts.disabled;
  b.addEventListener('click', onClick);
  return b;
}

/** 清單空白時的提示列 */
export function emptyItem(text: string): HTMLElement {
  return el('div', { className: 'item empty-item' }, el('span', { className: 'grow', text }));
}

let statusTimer = 0;

/** 狀態訊息；error 會一直留著，一般訊息 8 秒後淡掉 */
export function setStatus(text: string, kind: 'info' | 'error' = 'info'): void {
  const node = $('status');
  node.textContent = text;
  node.dataset.kind = kind;
  clearTimeout(statusTimer);
  if (text && kind === 'info') {
    statusTimer = window.setTimeout(() => {
      if (node.textContent === text) node.textContent = '';
    }, 8000);
  }
}
