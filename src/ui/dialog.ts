/** 網頁內的確認／輸入對話框（取代 confirm() 和 prompt()，在 Claude Artifact 裡也能用） */
import { el } from './dom';

function open<T>(build: (close: (v: T) => void) => HTMLElement[], cancelValue: T): Promise<T> {
  return new Promise((resolve) => {
    const dialog = el('dialog', { className: 'dialog' });
    let done = false;
    const close = (v: T) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(v);
    };
    dialog.append(...build(close));
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(cancelValue);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

function actions(okText: string, onOk: () => void, onCancel: () => void, danger = false): HTMLElement {
  const cancel = el('button', { text: '取消', attrs: { type: 'button' } });
  cancel.addEventListener('click', onCancel);
  const ok = el('button', { text: okText, className: danger ? 'danger' : 'confirm', attrs: { type: 'submit' } });
  ok.addEventListener('click', (e) => {
    e.preventDefault();
    onOk();
  });
  return el('div', { className: 'dialog-actions' }, cancel, ok);
}

export function askConfirm(message: string, okText = '確定', danger = true): Promise<boolean> {
  return open<boolean>(
    (close) => [
      el('p', { text: message }),
      actions(okText, () => close(true), () => close(false), danger),
    ],
    false,
  );
}

export function askText(title: string, defaultValue = '', okText = '儲存'): Promise<string | null> {
  return open<string | null>((close) => {
    const input = el('input', { attrs: { type: 'text', id: 'dialogInput', autocomplete: 'off' } });
    input.value = defaultValue;
    const submit = () => {
      const v = input.value.trim();
      if (v) close(v);
      else input.focus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    queueMicrotask(() => input.select());
    return [
      el('label', { className: 'dialog-label', attrs: { for: 'dialogInput' }, text: title }),
      input,
      actions(okText, submit, () => close(null), false),
    ];
  }, null);
}
