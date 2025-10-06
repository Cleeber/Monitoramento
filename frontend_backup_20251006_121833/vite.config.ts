import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001, // Alterado de 3000 para 3001 para alinhar com o ambiente de testes
    strictPort: true, // Garante falha caso a porta 3001 esteja ocupada, evitando mudança automática para 3002/3003
    host: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '85.31.62.181',
      'monitor.pagina1digital.com.br'
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
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    global: 'globalThis',
  },
})