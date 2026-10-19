import type { BaseImage, Head, Person, RosterItem, StyleOptions, Template } from './types';

/** 狀態變動的類別，介面各區塊只訂閱自己在意的部分 */
export type Topic =
  | 'templates' // 底圖選單內容或目前選擇
  | 'base' // 底圖圖片
  | 'heads' // 頭的位置
  | 'people' // 留言的人（新增、刪除、排序）
  | 'names' // 只有帳號文字改變（不重建輸入框，避免失去焦點）
  | 'style' // 樣式選項、頭貼大小
  | 'roster' // 常用名單內容
  | 'rosterNames'; // 只有名單裡的帳號文字改變

export interface AppState {
  templates: Template[];
  /** 目前選擇的底圖 key；上傳但還沒存的底圖是 UPLOAD_KEY */
  activeKey: string | null;
  base: BaseImage | null;
  heads: Head[];
  /** 頭貼大小，佔圖寬的百分比 */
  size: number;
  people: Person[];
  roster: RosterItem[];
  style: StyleOptions;
}

export const UPLOAD_KEY = 'upload';

export const state: AppState = {
  templates: [],
  activeKey: null,
  base: null,
  heads: [],
  size: 10,
  people: [],
  roster: [],
  style: {
    showMarks: true,
    showQuestion: true,
    questionColor: '#ffffff',
    showName: true,
    withAt: true,
  },
};

const listeners = new Map<Topic, Set<() => void>>();

export function on(topics: Topic[], fn: () => void): void {
  for (const t of topics) {
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t)!.add(fn);
  }
}

/** 通知訂閱者；同一個函式就算訂了多個類別也只會被呼叫一次 */
export function emit(...topics: Topic[]): void {
  const fns = new Set<() => void>();
  for (const t of topics) listeners.get(t)?.forEach((fn) => fns.add(fn));
  fns.forEach((fn) => fn());
}
