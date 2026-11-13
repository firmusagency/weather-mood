import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';
import { resolve } from 'node:path';

const CDN = {
  react: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  reactDom: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  qrcode: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
};

/** Adds library <script> tags (classic scripts run before the deferred app module). */
const scriptsFromCdn = (srcs: string[]): Plugin => ({
  name: 'scripts-from-cdn',
  transformIndexHtml: () => srcs.map((src) => ({ tag: 'script', attrs: { src, crossorigin: 'anonymous' }, injectTo: 'head-prepend' as const })),
});

/** The demo pages cannot carry font files: they keep the hosted stylesheet the live site no longer uses. */
const DEMO_FONTS = 'https://fonts.googleapis.com/css2?family=Commissioner:wght@400;500;600;700&family=Literata:opsz,wght@7..72,500;7..72,600&family=JetBrains+Mono:wght@400;500&display=swap';
const hostedFonts = (): Plugin => ({
  name: 'hosted-fonts-for-demos',
  transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'stylesheet', href: DEMO_FONTS }, injectTo: 'head' as const }],
});

/*
 * Pages: index.html = hotel dashboard, guest.html = guest phone page + reception screen.
 *
 * `--mode single` builds one shareable demo page (ENTRY=guest for the guest page): app code and
 * the forecast snapshot inlined, libraries loaded from cdnjs as UMD globals instead of bundled.
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const entry = process.env.ENTRY === 'guest' ? 'guest' : process.env.ENTRY === 'accuracy' ? 'accuracy' : 'index';
  const libs = entry === 'guest' ? [CDN.react, CDN.reactDom, CDN.qrcode] : [CDN.react, CDN.reactDom];
  return {
    // GitHub Pages serves the site under /weather-mood/ (set VITE_BASE in the deploy workflow)
    base: single ? '/' : process.env.VITE_BASE || '/',
    plugins: single ? [react({ jsxRuntime: 'classic' }), scriptsFromCdn(libs), hostedFonts(), viteSingleFile()] : [react()],
    // the live site serves its own fonts (src/fonts.css); a single-file demo gets an empty file in their place
    resolve: single ? { alias: [{ find: /^.*\/fonts(-data)?\.css$/, replacement: resolve(__dirname, 'src/fonts-demo.css') }] } : undefined,
    esbuild: single ? { jsxInject: `import React from 'react'` } : undefined,
    publicDir: single ? false : 'public',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: !single,
      rollupOptions: single
        ? {
            input: resolve(__dirname, `${entry}.html`),
            external: ['react', 'react-dom', 'react-dom/client', 'qrcode-generator'],
            output: {
              format: 'iife',
              globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', 'qrcode-generator': 'qrcode' },
            },
          }
        : { input: { index: resolve(__dirname, 'index.html'), guest: resolve(__dirname, 'guest.html'), accuracy: resolve(__dirname, 'accuracy.html') } },
    },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
