import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  server: {
    port: 41031,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:42031',
        changeOrigin: true
      }
    }
  }
});
