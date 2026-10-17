import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';

const REACT_UMD = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
];

/** Adds the React UMD <script> tags (classic scripts run before the deferred app module). */
const reactFromCdn = (): Plugin => ({
  name: 'react-from-cdn',
  transformIndexHtml: () => REACT_UMD.map((src) => ({ tag: 'script', attrs: { src, crossorigin: 'anonymous' }, injectTo: 'head-prepend' as const })),
});

// `--mode single` builds the shareable demo: one HTML file with the app code and the forecast
// snapshot inlined, and React 18 loaded from cdnjs (UMD globals) instead of being bundled.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: single ? [react({ jsxRuntime: 'classic' }), reactFromCdn(), viteSingleFile()] : [react()],
    esbuild: single ? { jsxInject: `import React from 'react'` } : undefined,
    build: {
      outDir: single ? 'dist-single' : 'dist',
      rollupOptions: single
        ? {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
          }
        : undefined,
    },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
