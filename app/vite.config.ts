import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → normal build for the desktop app (Tauri loads app/dist).
// `npm run build:demo` → one self-contained HTML file for the web demo.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    target: 'es2022',
    assetsInlineLimit: mode === 'demo' ? 100_000_000 : 4096,
  },
}));
