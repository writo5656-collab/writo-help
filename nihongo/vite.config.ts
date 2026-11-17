import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every path relative so the same build works inside the
// Android app (Capacitor) and on any web host sub-folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any);
