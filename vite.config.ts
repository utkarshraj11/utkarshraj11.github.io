import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { postsPlugin } from './build/posts-plugin.ts';

// Relative base works for both <user>.github.io and <user>.github.io/<repo>/,
// since routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [postsPlugin(), react()],
  worker: { format: 'es' },
});
