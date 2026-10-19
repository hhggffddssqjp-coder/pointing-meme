/** 主題切換：自動（跟系統）→ 淺色 → 深色 */
import { readPref, writePref } from '../prefs';
import { $ } from './dom';

type Theme = 'auto' | 'light' | 'dark';
const ORDER: Theme[] = ['auto', 'light', 'dark'];
const LABEL: Record<Theme, string> = { auto: '自動', light: '淺色', dark: '深色' };

function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const btn = $('themeToggle');
  btn.textContent = `主題：${LABEL[theme]}`;
  btn.setAttribute('aria-label', `切換主題，目前是${LABEL[theme]}`);
}

export function initTheme(): void {
  let theme = readPref<Theme>('theme', 'auto');
  if (!ORDER.includes(theme)) theme = 'auto';
  apply(theme);
  $('themeToggle').addEventListener('click', () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    apply(theme);
    writePref('theme', theme);
  });
}
