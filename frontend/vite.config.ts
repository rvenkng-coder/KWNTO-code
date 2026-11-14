import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The app lives in frontend/, but the build output stays at the repo root.
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': {
        target: process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/_': {
        target: process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },
})
