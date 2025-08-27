import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET // e.g. https://n8n.example.com/webhook/your-endpoint

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: proxyTarget
        ? {
            '/n8n': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/n8n/, '')
            }
          }
        : undefined
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: 'all'
    }
  }
})
