import { defineConfig } from 'vite';

export default defineConfig({
  // Set base to relative paths so it deploys flawlessly to any subdirectory on GitHub Pages
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
