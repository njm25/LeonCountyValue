import { defineConfig } from 'vite'

// Relative base so the built asset + data paths work no matter what
// case or subpath GitHub Pages serves the project site under.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
})
