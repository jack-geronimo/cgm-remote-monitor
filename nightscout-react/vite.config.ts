import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const nightscoutUrl = env.VITE_API_URL || 'http://localhost:1337'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy API requests to Nightscout backend
        '/api': {
          target: nightscoutUrl,
          changeOrigin: true,
          secure: false,
        },
        // Proxy Socket.io requests
        '/socket.io': {
          target: nightscoutUrl,
          changeOrigin: true,
          secure: false,
          ws: true, // Enable WebSocket proxying
        },
      },
    },
  }
})
