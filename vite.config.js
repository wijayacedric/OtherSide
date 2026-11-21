import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiMiddleware } from './server/api.js'

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    {
      name: 'otherside-api',
      configureServer(server) {
        server.middlewares.use(apiMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(apiMiddleware())
      },
    },
  ],
})
