import { defineConfig } from 'vite';

// base: './' 讓輸出的網站可以放在任何子路徑（例如 GitHub Pages 的 /repo-name/）
export default defineConfig({
  base: './',
  server: {
    // Artifact 版的輸出不用監看（OneDrive 同步時鎖檔會讓監看當掉）
    watch: { ignored: ['**/dist-artifact/**'] },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
