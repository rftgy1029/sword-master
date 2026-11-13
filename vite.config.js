import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode single`: 한 파일짜리 HTML을 만들기 위한 빌드(npm run build:single).
// 모든 import 자산을 data URL로 넣고 코드를 한 덩어리로 묶는다. public/ 파일은 scripts/build-single.mjs가 넣는다.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  server: { allowedHosts: ['terminal.local'] },
  ...(mode === 'single' ? {
    build: {
      outDir: 'dist-single',
      emptyOutDir: true,
      copyPublicDir: false,
      assetsInlineLimit: () => true,
      cssCodeSplit: false,
      modulePreload: false,
      chunkSizeWarningLimit: 100000,
      rolldownOptions: { output: { inlineDynamicImports: true } },
    },
  } : {}),
}));
