import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Serves the app (app/app.html, with HMR) and the preview host (preview/index.html) from ui/.
const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: { port: 6040, strictPort: true },
});
