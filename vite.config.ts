import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Personal Finance Manager',
        short_name: 'Keuangan',
        description: 'Pencatat keuangan pribadi yang berjalan lokal di perangkat Anda.',
        theme_color: '#010102',
        background_color: '#010102',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['tesseract/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // OCR engine + language data: cached on first scan, reusable offline afterwards.
            urlPattern: ({ url }) => url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-assets-v1', expiration: { maxEntries: 12 } },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { recharts: ['recharts'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
