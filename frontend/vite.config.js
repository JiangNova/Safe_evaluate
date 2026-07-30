import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/evaluate_tianxin/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 300000,        // 5 min — matches axios timeout for long evaluations
        proxyTimeout: 300000,   // 5 min — wait for backend to finish retries + failover
      },
    },
  },
});
