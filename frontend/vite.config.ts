import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    fs: {
      // Allow serving files from the parent directory (for PMTiles)
      allow: ['..', '.']
    },
    headers: {
      // Set correct MIME type for PMTiles
      '*.pmtiles': {
        'Content-Type': 'application/octet-stream'
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'deck-gl': ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/extensions', '@deck.gl/react'],
          'loaders': ['@loaders.gl/pmtiles', '@loaders.gl/core'],
          'maplibre': ['maplibre-gl', 'react-map-gl'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  define: {
    // Ensure process.env is available for some libraries
    'process.env': {}
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-range',
      'react-router-dom',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/extensions',
      '@deck.gl/react',
      '@loaders.gl/pmtiles',
      '@loaders.gl/core',
      'maplibre-gl',
      'react-map-gl'
    ]
  }
})
