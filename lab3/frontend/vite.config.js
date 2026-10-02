import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true // Нужно для стабильного HMR внутри Docker volumes
    },
    proxy: {
      '/api': {
        target: 'http://app:3000', // Имя сервиса бэкенда из docker-compose
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://app:3000',
        changeOrigin: true
      }
    }
  }
});