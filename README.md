# 互指梗圖產生器

選一張互指梗圖，貼上 Threads 留言截圖，自動裁出頭貼蓋到每個人頭上，再加上問號和帳號，下載成 PNG。

純前端靜態網站（Vite + 原生 TypeScript），所有資料都留在使用者自己的瀏覽器裡，不會上傳到任何伺服器。

## 放底圖

內建三張底圖的圖片不包含在專案裡，請自己放進 `public/templates/`：

| 檔名     | 名稱        | 原始尺寸   |
| -------- | ----------- | ---------- |
| `3.png`  | 3 人互指版  | 1920×1080 |
| `7.jpg`  | 7 人圍圈版  | 716×659   |
| `13.png` | 13 人圍攻版 | 750×422   |
| `circle.webp` | 14 人大圓圈版 | 1001×751（已附在專案裡） |

圖片沒放的話，選到那張底圖時畫面會提示「找不到圖片」，其他功能照常可以用。

### templates.json

每張內建底圖的設定在 `public/templates/templates.json`：

```json
{
  "templates": [
    {
      "id": "3",
      "file": "3.png",
      "name": "3 人互指版",
      "width": 1920,
      "height": 1080,
      "size": 8,
      "heads": [
        { "x": 410, "y": 275, "side": "R" },
        { "x": 1505, "y": 320, "side": "L", "scale": 1.3 }
      ]
    }
  ]
}
```

| 欄位             | 說明                                                         |
| ---------------- | ------------------------------------------------------------ |
| `id`             | 唯一識別碼，不要和其他底圖重複                               |
| `file`           | `public/templates/` 裡的檔名                                 |
| `name`           | 顯示在下拉選單的名稱                                         |
| `width`、`height` | 原圖的像素寬高                                               |
| `size`           | 預設頭貼直徑，佔圖寬的百分比                                 |
| `heads[].x`、`y`  | 頭中心點的**原圖像素座標**（讀進來後會自動換成 0~1 的相對座標） |
| `heads[].side`   | 問號在頭的 `"L"` 左邊或 `"R"` 右邊，預設 `"R"`               |
| `heads[].scale`  | 這個頭的大小倍率，預設 `1`                                   |

要新增內建底圖：把圖放進 `public/templates/`，在 `templates` 陣列加一筆即可。這個檔案是執行時才讀取的，部署後直接改 `dist/templates/templates.json` 也會生效，不用重新 build。

> 小技巧：用網頁上傳新底圖、在圖上點好位置後，可以從預覽畫面量出座標，再抄進 `templates.json`。

## 啟動

需要 [Node.js](https://nodejs.org/) 18 以上。

```bash
npm install
```

```bash
npm run dev
```

開啟終端機顯示的網址（預設是 http://localhost:5173）。想用手機測試，可以改跑 `npm run dev -- --host`，再用手機開同網段的網址。

## 建置與部署

```bash
npm run build
```

輸出在 `dist/`，是純靜態檔案，整個資料夾丟到任何靜態主機就能用：

- **GitHub Pages**（已設定好）：`.github/workflows/deploy.yml` 會在每次推到 `main` 時自動 build 並部署。第一次要到 repo 的 Settings → Pages，把 Source 設成「GitHub Actions」
- **Netlify / Vercel / Cloudflare Pages**：建置指令填 `npm run build`，輸出目錄填 `dist`
- **自己的主機**：把 `dist/` 的內容上傳到網站目錄

`vite.config.ts` 設了 `base: './'`，所以放在子路徑（例如 `https://example.com/meme/`）也能正常運作。

### Claude Artifact 版

```bash
npm run build:artifact
```

會在 `dist-artifact/` 產生可以發布成 Claude Artifact 的版本：CSS 和 JS 內嵌進頁面，`templates.json` 只保留圖片存在的底圖。在 Artifact 裡下載 PNG 走 Artifact 的 `downloads` 功能，無法使用時會改成顯示圖片讓人長按或右鍵另存。

本機預覽建置結果：

```bash
npm run preview
```

> 注意：直接雙擊打開 `dist/index.html`（`file://`）無法讀取 `templates.json`，請用上面的方式或任何本機伺服器開啟。

## 使用方式

1. **梗圖底圖**：從下拉選單選內建底圖，或上傳自己的圖。上傳的圖點好位置後按「存進選單」，會存在瀏覽器的 IndexedDB；之後改了位置可以按「更新位置」。
2. **頭的位置**：在圖上點一下新增位置、拖曳移動。每個位置可以放大縮小、切換問號左右、刪除。「顯示位置標記」只影響預覽，下載時不會畫出來。
3. **留言的人**：上傳、按 Ctrl+V 貼上，或直接把截圖檔拖進網頁。可以一次選很多張，也可以貼一張包含很多則留言的長截圖，每個人的圓形頭貼都會被裁出來；接近正方形的圖會當作已裁好的頭貼直接用。帳號自己填，可以上移、刪除、打亂順序。
4. **常用名單**：貼過的人會自動存進名單（頭貼縮成 200px）。之後勾選就能加入，可全選、全不選、從名單刪除；名單裡也可以直接改帳號。
5. **樣式**：調整頭貼大小、問號顏色（白／黃／紅）、要不要加帳號和 @。
6. 按「**下載梗圖 PNG**」。輸出寬度至少 1400px，底圖比較小時會等比放大。

右上角可以切換主題（自動／淺色／深色）。

## 專案結構

```
public/templates/      內建底圖圖片與 templates.json
src/
  main.ts              進入點，依序初始化各區塊
  state.ts             全域狀態與簡單的訂閱／通知
  types.ts             共用型別
  templates.ts         底圖與位置：讀 templates.json、使用者底圖的存取、位置規則
  avatar.ts            頭貼擷取：extractAvatar 演算法
  roster.ts            名單儲存：常用名單的存取
  render.ts            繪圖：頭貼、問號、帳號、標記、字型載入
  db.ts                IndexedDB 包裝
  image.ts             圖片載入、canvas 工具
  prefs.ts             localStorage 小偏好（主題、樣式、上次的底圖）
  ui/                  介面：每個區塊一個檔案
    stage.ts           預覽畫布、點擊新增與拖曳
    templatePanel.ts   1. 底圖
    headsPanel.ts      2. 頭的位置
    peoplePanel.ts     3. 留言的人
    rosterPanel.ts     4. 常用名單
    stylePanel.ts      5. 樣式
    exportPanel.ts     下載
    theme.ts           主題切換
    dom.ts             DOM 小工具與狀態訊息
  style.css
```

### 頭貼擷取的做法（`src/avatar.ts`）

每張截圖先試「多則留言」的找法，找到 2 個以上頭貼就全部使用；否則改用「單則留言」的找法。兩種都用四個角落顏色的中位數當背景色。

**多則留言的長截圖**

1. 略過橫跨大半寬度的列（分隔線、整排圖片）。
2. 在圖的左邊 30% 找最左邊的一段欄位，當作「頭貼欄」。
3. 在頭貼欄裡逐列計算，每段夠寬的連續列就是一個頭貼；頭貼之間的細串連線會被濾掉。
4. 只留接近正方形、大小和其他頭貼差不多的（排除返回箭頭之類的小圖示）。

**單則留言**

1. 取四個角落顏色的中位數當背景色。
2. 在圖的左側（寬度最多到高度的 1.2 倍）逐欄計算和背景差異大的像素數，找出最左邊、寬度至少是圖高 18% 的連續欄位區段。
3. 在這段欄位內逐列計算，找出最長的連續列範圍。
4. 取兩者較短的一邊裁成正方形；找不到時就取圖左邊的正方形。

### 字型

文字使用 Google Fonts 的 Noto Sans TC（900 粗體）。中文字型是依字元分片下載的，所以每次畫圖前都會先要求載入畫面上用到的字元，等字型好了才畫，避免第一次畫出來用到備用字型。網路太慢時最多等 4 秒，之後字型到了會自動重畫。
