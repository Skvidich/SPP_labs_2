import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const GATEWAY_URL = process.env.GATEWAY_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/graphql': {
        target: `http://${GATEWAY_URL}`,
        changeOrigin: true,
      },
    },
  },
});