import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // /api/vision → LFM 2.5-1.2B-Thinking on localhost:8080
          // In dev: Vite proxies browser requests to the local inference server.
          // In prod (workshop.grizzlymedicine.icu): add nginx location /api/vision
          //   proxy_pass http://localhost:8080/v1/chat/completions;
          '/api/vision': {
            target: 'http://localhost:8080',
            changeOrigin: true,
            rewrite: () => '/v1/chat/completions',
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
