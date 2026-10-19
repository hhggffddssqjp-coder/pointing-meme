import { defineConfig } from 'vite';

// base: './' 讓輸出的網站可以放在任何子路徑（例如 GitHub Pages 的 /repo-name/）
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
