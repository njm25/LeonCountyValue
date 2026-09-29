import { defineConfig } from 'vite'

// Project page served at https://njm25.github.io/leoncountyvalue/
// so the base path must match the repo name.
export default defineConfig({
  base: '/leoncountyvalue/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
})
