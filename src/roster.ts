/** 名單儲存：貼過的人存在 IndexedDB，頭貼縮成 200px */
import { avatarHash, resizeSquare } from './avatar';
import * as db from './db';
import { canvasToBlob, loadImage } from './image';
import type { RosterItem } from './types';

export const ROSTER_AVATAR_SIZE = 200;

interface StoredRosterItem {
  id: string;
  name: string;
  avatar: Blob;
  createdAt: number;
  updatedAt: number;
}

function toItem(r: StoredRosterItem, hash?: string): RosterItem {
  return { id: r.id, name: r.name, avatar: r.avatar, url: URL.createObjectURL(r.avatar), createdAt: r.createdAt, hash };
}

/** 讀名單時順便算每個頭貼的指紋（200px 的小圖，很快） */
export async function loadRoster(): Promise<RosterItem[]> {
  const rows = await db.getAll<StoredRosterItem>('roster');
  rows.sort((a, b) => a.createdAt - b.createdAt);
  return Promise.all(
    rows.map(async (r) => {
      const item = toItem(r);
      try {
        item.hash = avatarHash(await loadImage(item.url));
      } catch {
        /* 壞掉的圖就不參與重複判斷 */
      }
      return item;
    }),
  );
}

/** 把頭貼縮成名單用的大小，輸出 PNG */
export function makeRosterAvatar(avatar: CanvasImageSource): Promise<Blob> {
  return canvasToBlob(resizeSquare(avatar, ROSTER_AVATAR_SIZE), 'image/png');
}

export async function addToRoster(avatar: Blob, name = '', hash?: string): Promise<RosterItem> {
  const now = Date.now();
  const record: StoredRosterItem = { id: db.newId(), name, avatar, createdAt: now, updatedAt: now };
  await db.put('roster', record);
  return toItem(record, hash);
}

export async function renameRosterItem(item: RosterItem, name: string): Promise<void> {
  item.name = name;
  await db.put<StoredRosterItem>('roster', {
    id: item.id,
    name,
    avatar: item.avatar,
    createdAt: item.createdAt,
    updatedAt: Date.now(),
  });
}

export async function removeFromRoster(items: RosterItem[]): Promise<void> {
  for (const item of items) {
    await db.remove('roster', item.id);
    URL.revokeObjectURL(item.url);
  }
}
