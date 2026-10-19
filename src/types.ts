/** 問號在頭的左邊（L）或右邊（R） */
export type Side = 'L' | 'R';

/** 一個頭的位置。x、y 是 0~1 的相對座標，scale 是相對於預設大小的倍率 */
export interface Head {
  x: number;
  y: number;
  side: Side;
  scale: number;
}

/** 底圖（內建或使用者存的） */
export interface Template {
  key: string;
  source: 'builtin' | 'user';
  name: string;
  /** 圖片網址 */
  src: string;
  width: number;
  height: number;
  /** 預設頭貼大小，佔圖寬的百分比 */
  size: number;
  heads: Head[];
  /** 使用者底圖在 IndexedDB 裡的 id */
  id?: string;
}

/** 目前畫布上的底圖 */
export interface BaseImage {
  image: HTMLImageElement;
  url: string;
  width: number;
  height: number;
  /** 上傳的原始檔案，存進選單時使用 */
  blob?: Blob;
}

/** 一位留言的人 */
export interface Person {
  id: number;
  name: string;
  /** 正方形頭貼；null 表示只有帳號 */
  image: CanvasImageSource | null;
  /** 列表縮圖網址 */
  thumb: string | null;
  /** 對應的常用名單項目 */
  rosterId?: string;
  /** 頭貼指紋，用來判斷重複 */
  hash?: string;
}

/** 常用名單裡的一個人 */
export interface RosterItem {
  id: string;
  name: string;
  avatar: Blob;
  /** avatar 的 object URL */
  url: string;
  createdAt: number;
  /** 頭貼指紋，用來判斷重複 */
  hash?: string;
  /** 頭貼邊長（px） */
  size?: number;
}

export interface StyleOptions {
  showMarks: boolean;
  showQuestion: boolean;
  questionColor: string;
  showName: boolean;
  withAt: boolean;
}
