import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
