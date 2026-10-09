import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.PHARMADESK_API_PORT || '5001'
const clientPort = Number(process.env.PHARMADESK_CLIENT_PORT || 5174)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pharmadesk-dev-identity',
      configureServer(server) {
        server.middlewares.use('/__pharmadesk_dev_identity', (_req, res) => {
          res.setHeader('Content-Type', 'text/plain');
          res.end(`sardar-pharmacy-dev-client-v2:${apiPort}`);
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: clientPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/ws/scanner': {
        target: `ws://127.0.0.1:${apiPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }

          if (
            id.includes('react') ||
            id.includes('scheduler') ||
            id.includes('use-sync-external-store')
          ) {
            return 'react-vendor';
          }

          if (
            id.includes('@tanstack') ||
            id.includes('axios')
          ) {
            return 'data-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return 'vendor';
        },
      },
    },
  },
})
