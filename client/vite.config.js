import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // In production (Render), the client is served from the same origin as the
  // Express server, so API calls use a relative /api path (no host prefix).
  // In dev, Vite's dev server proxies /api → http://localhost:4000.
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Output directory relative to client/ — server looks for ../../client/dist
    outDir: 'dist',
    // Increase chunk size warning limit (Konva + pptxgenjs are large)
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // Split large dependencies into separate chunks for better caching
        manualChunks: {
          'konva':    ['konva', 'react-konva'],
          'pptxgenjs': ['pptxgenjs'],
          'jspdf':    ['jspdf'],
          'firebase': ['firebase/app', 'firebase/auth'],
        },
      },
    },
  },
}))
