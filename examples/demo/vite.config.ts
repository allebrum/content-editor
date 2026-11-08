import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@allebrum/page-editor': path.resolve(__dirname, '../../src/index.ts'),
      '@allebrum/page-editor/styles.css': path.resolve(__dirname, '../../src/styles/styles.css'),
    },
  },
});
