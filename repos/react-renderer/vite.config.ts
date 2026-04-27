import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/resolve': 'http://localhost:3000',
      '/impulses': 'http://localhost:3000',
    },
  },
})
