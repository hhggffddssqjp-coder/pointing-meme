import { defineConfig } from 'vite';

// base: './' 讓輸出的網站可以放在任何子路徑（例如 GitHub Pages 的 /repo-name/）
export default defineConfig({
  base: './',
  server: {
    // 專案放在 OneDrive 裡，同步時會鎖住剛新增的檔案，原生監看會因此當掉，改用輪詢
    watch: { usePolling: true, interval: 300, ignored: ['**/dist-artifact/**'] },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
