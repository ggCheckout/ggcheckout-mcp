import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = fileURLToPath(new URL('.', import.meta.url));

// One self-contained HTML for every view: the server reads it as the ui://ggcheckout/app.html
// resource and hosts load it in a sandbox without network, so every script, style, font and image
// goes inline.
export default defineConfig({
  base: './',
  root: resolve(root, 'app'),
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssMinify: true,
    minify: true,
    emptyOutDir: false,
    outDir: resolve(root, '../dist/views'),
    rollupOptions: { input: resolve(root, 'app/app.html') },
  },
  test: { root, include: ['src/**/*.test.ts'] },
});
