import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      renderer: 'src/renderer.tsx',
      server: 'src/server.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'lucide-react', /^lucide-react\//],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
    outDir: 'dist',
  },
  {
    entry: {
      styles: 'src/styles/styles.css',
    },
    format: ['esm'],
    dts: false,
    outDir: 'dist',
    loader: {
      '.css': 'copy',
    },
  },
]);
