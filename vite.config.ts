import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  plugins: [react()],
  // Forçar mode via config evita conflito com NODE_ENV do .env.production
  mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    host: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '85.31.62.181',
      'monitor.pagina1digital.com.br',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'client-dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  define: {
    global: 'globalThis',
  },
})
