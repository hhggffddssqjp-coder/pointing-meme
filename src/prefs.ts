/** 存在 localStorage 的小偏好設定（主題、樣式、上次的底圖）。讀寫失敗時就當作沒有。 */
const PREFIX = 'pointing-meme:';

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 私密模式或空間不足時忽略 */
  }
}
