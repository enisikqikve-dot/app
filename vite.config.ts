import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "artifact" mode bundles everything into one self-contained HTML file,
// so the game can be shared as a single link.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [preact(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
