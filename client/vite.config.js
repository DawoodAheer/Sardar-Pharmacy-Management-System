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
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Silently ignore connection errors — these happen during nodemon
            // restarts (ECONNREFUSED) or when the server is reloading (ECONNRESET).
            // Return a clean 503 JSON to the frontend instead of crashing.
            const ignored = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
            if (!ignored.includes(err.code)) {
              console.log('[vite proxy] unexpected error:', err.message);
            }
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              try {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Server is starting up, please wait a moment and try again.' }));
              } catch { /* ignore */ }
            }
          });
        },
      },
      '/ws/scanner': {
        target: `ws://127.0.0.1:${apiPort}`,
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const ignored = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
            if (!ignored.includes(err.code)) {
              console.log('[vite proxy ws] unexpected error:', err.message);
            }
          });
        },
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

          if (id.includes('/xlsx/') || id.includes('\\xlsx\\')) return 'spreadsheets';
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
