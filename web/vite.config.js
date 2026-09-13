import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './', // 상대 경로로 번들링하여 Android WebView 로컬 로드 지원
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 5173,
    open: false
  }
});
