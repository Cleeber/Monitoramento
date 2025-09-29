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
    // Proxy removido para produção - URLs da API são definidas via variáveis de ambiente
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
})