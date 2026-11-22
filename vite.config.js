import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ADMIN_ENTRY = fileURLToPath(new URL('./src/admin/entry.js', import.meta.url));
const ADMIN_RUNTIME = fileURLToPath(new URL('./src/admin/runtime.jsx', import.meta.url));

function adminEntryPlugin(enabled) {
  return {
    name: 'sword-master-admin-entry',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!enabled) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved?.id === ADMIN_ENTRY) return ADMIN_RUNTIME;
      return null;
    },
  };
}

// `vite build --mode single`: 일반 한 파일짜리 HTML 빌드(npm run build:single).
// `vite build --mode single-admin`: 관리자 전용 한 파일짜리 HTML 빌드(npm run build:admin).
// 일반 빌드(dev·build·single)에서는 src/admin/entry.js가 noop으로 남아 관리자 코드·CSS가 전혀 포함되지 않는다.
export default defineConfig(({ mode }) => {
  const isAdmin = mode === 'single-admin' || mode === 'admin';
  const isSingle = mode === 'single' || mode === 'single-admin';
  return {
    plugins: [adminEntryPlugin(isAdmin), react()],
    base: './',
    server: { allowedHosts: ['terminal.local'] },
    ...(isSingle ? {
      build: {
        outDir: mode === 'single-admin' ? 'dist-single-admin' : 'dist-single',
        emptyOutDir: true,
        copyPublicDir: false,
        assetsInlineLimit: () => true,
        cssCodeSplit: false,
        modulePreload: false,
        chunkSizeWarningLimit: 100000,
        rolldownOptions: { output: { inlineDynamicImports: true } },
      },
    } : {}),
  };
});
