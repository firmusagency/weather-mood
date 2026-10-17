import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` bundles everything (JS, CSS, snapshot data) into one HTML file
// so the demo can be opened offline or published as a single page.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}));
