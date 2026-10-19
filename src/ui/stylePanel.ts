/** 第 5 區：頭貼大小、問號、帳號樣式 */
import { readPref, writePref } from '../prefs';
import { emit, on, state } from '../state';
import type { StyleOptions } from '../types';
import { $ } from './dom';

const PREF_KEY = 'style';

function syncInputs(): void {
  const size = $<HTMLInputElement>('size');
  size.value = String(state.size);
  $('sizeValue').textContent = `${state.size}%`;
  $<HTMLSelectElement>('questionColor').disabled = !state.style.showQuestion;
  $<HTMLInputElement>('withAt').disabled = !state.style.showName;
}

export function initStylePanel(): void {
  // 還原上次的樣式（標記開關也一起存）
  Object.assign(state.style, readPref<Partial<StyleOptions>>(PREF_KEY, {}));

  const size = $<HTMLInputElement>('size');
  size.addEventListener('input', () => {
    state.size = Number(size.value);
    emit('style');
  });

  const showQuestion = $<HTMLInputElement>('showQuestion');
  const questionColor = $<HTMLSelectElement>('questionColor');
  const showName = $<HTMLInputElement>('showName');
  const withAt = $<HTMLInputElement>('withAt');

  showQuestion.checked = state.style.showQuestion;
  questionColor.value = state.style.questionColor;
  if (questionColor.selectedIndex < 0) questionColor.selectedIndex = 0;
  showName.checked = state.style.showName;
  withAt.checked = state.style.withAt;

  const update = () => {
    state.style.showQuestion = showQuestion.checked;
    state.style.questionColor = questionColor.value;
    state.style.showName = showName.checked;
    state.style.withAt = withAt.checked;
    emit('style');
  };
  for (const input of [showQuestion, questionColor, showName, withAt]) input.addEventListener('change', update);

  on(['style', 'base'], () => {
    syncInputs();
    writePref(PREF_KEY, state.style);
  });
  syncInputs();
}
