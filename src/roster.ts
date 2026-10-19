/** 名單儲存：貼過的人存在 IndexedDB，頭貼最大存 512px */
import { avatarHash, resizeSquare } from './avatar';
import * as db from './db';
import { canvasToBlob, loadImage, pixelWidth } from './image';
import type { RosterItem } from './types';

/** 名單裡頭貼的最大邊長；比這小的頭貼照原尺寸存，不放大 */
export const ROSTER_AVATAR_MAX = 512;

interface StoredRosterItem {
  id: string;
  name: string;
  avatar: Blob;
  createdAt: number;
  updatedAt: number;
}

function toRecord(item: RosterItem): StoredRosterItem {
  return { id: item.id, name: item.name, avatar: item.avatar, createdAt: item.createdAt, updatedAt: Date.now() };
}

function toItem(r: StoredRosterItem, hash?: string, size?: number): RosterItem {
  return { id: r.id, name: r.name, avatar: r.avatar, url: URL.createObjectURL(r.avatar), createdAt: r.createdAt, hash, size };
}

/** 讀名單時順便算每個頭貼的指紋和尺寸 */
export async function loadRoster(): Promise<RosterItem[]> {
  const rows = await db.getAll<StoredRosterItem>('roster');
  rows.sort((a, b) => a.createdAt - b.createdAt);
  return Promise.all(
    rows.map(async (r) => {
      const item = toItem(r);
      try {
        const img = await loadImage(item.url);
        item.hash = avatarHash(img);
        item.size = img.naturalWidth;
      } catch {
        /* 壞掉的圖就不參與重複判斷 */
      }
      return item;
    }),
  );
}

/** 把頭貼轉成名單用的 PNG：超過 ROSTER_AVATAR_MAX 才縮小 */
export function makeRosterAvatar(avatar: CanvasImageSource): Promise<{ blob: Blob; size: number }> {
  const size = Math.max(1, Math.min(ROSTER_AVATAR_MAX, pixelWidth(avatar)));
  return canvasToBlob(resizeSquare(avatar, size), 'image/png').then((blob) => ({ blob, size }));
}

export async function addToRoster(avatar: Blob, size: number, name = '', hash?: string): Promise<RosterItem> {
  const now = Date.now();
  const record: StoredRosterItem = { id: db.newId(), name, avatar, createdAt: now, updatedAt: now };
  await db.put('roster', record);
  return toItem(record, hash, size);
}

export async function renameRosterItem(item: RosterItem, name: string): Promise<void> {
  item.name = name;
  await db.put('roster', toRecord(item));
}

/** 換成比較清楚的頭貼（同一個人、解析度更高的截圖） */
export async function replaceRosterAvatar(item: RosterItem, avatar: Blob, size: number, hash: string): Promise<void> {
  const prev = { avatar: item.avatar, url: item.url, size: item.size, hash: item.hash };
  item.avatar = avatar;
  item.size = size;
  item.hash = hash;
  try {
    await db.put('roster', toRecord(item));
  } catch (err) {
    Object.assign(item, prev);
    throw err;
  }
  item.url = URL.createObjectURL(avatar);
  URL.revokeObjectURL(prev.url);
}

export async function removeFromRoster(items: RosterItem[]): Promise<void> {
  for (const item of items) {
    await db.remove('roster', item.id);
    URL.revokeObjectURL(item.url);
  }
}
