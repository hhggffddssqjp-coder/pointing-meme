/** 名單儲存：貼過的人存在 IndexedDB，頭貼縮成 200px */
import { resizeSquare } from './avatar';
import * as db from './db';
import { canvasToBlob } from './image';
import type { RosterItem } from './types';

export const ROSTER_AVATAR_SIZE = 200;

interface StoredRosterItem {
  id: string;
  name: string;
  avatar: Blob;
  createdAt: number;
  updatedAt: number;
}

function toItem(r: StoredRosterItem): RosterItem {
  return { id: r.id, name: r.name, avatar: r.avatar, url: URL.createObjectURL(r.avatar), createdAt: r.createdAt };
}

export async function loadRoster(): Promise<RosterItem[]> {
  const rows = await db.getAll<StoredRosterItem>('roster');
  return rows.sort((a, b) => a.createdAt - b.createdAt).map(toItem);
}

/** 把頭貼縮成名單用的大小，輸出 PNG */
export function makeRosterAvatar(avatar: CanvasImageSource): Promise<Blob> {
  return canvasToBlob(resizeSquare(avatar, ROSTER_AVATAR_SIZE), 'image/png');
}

export async function addToRoster(avatar: Blob, name = ''): Promise<RosterItem> {
  const now = Date.now();
  const record: StoredRosterItem = { id: db.newId(), name, avatar, createdAt: now, updatedAt: now };
  await db.put('roster', record);
  return toItem(record);
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
