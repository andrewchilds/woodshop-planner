import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: { port: 5191, strictPort: true },
  preview: { port: 5191, strictPort: true },
});
