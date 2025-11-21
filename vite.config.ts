import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: This ensures assets use relative paths (e.g., "./assets/script.js" instead of "/assets/script.js")
  server: {
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})