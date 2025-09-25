// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || env.PORT || 3007)
  const publicUrl = env.VITE_PUBLIC_URL || `http://localhost:${port}`

  return {
    plugins: [react()],
    root: '.',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      strictPort: false, // se a porta estiver ocupada, usa a próxima disponível
      open: true,
      host: true, // permite acesso externo
      allowedHosts: ['dex.country'], // libera o domínio customizado
      proxy: {
        '/api': {
          target: env.VITE_API_GATEWAY_URL || 'https://whostler.com',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    metadata: {
      name: "Recovery Swap Aggregator",
      description: "Exchange deppeged tokens using the most liquidity routes",
      url: publicUrl,
    },
    optimizeDeps: {
      include: [
        '@reown/appkit',
        '@reown/appkit-adapter-ethers',
        'ethers',
        'react',
        'react-dom',
        'react-router-dom'
      ]
    },
    build: {
      sourcemap: true,
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        external: [],
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'web3-vendor': ['ethers', '@reown/appkit', '@reown/appkit-adapter-ethers']
          }
        }
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      }
    },
    envPrefix: ['VITE_']
  }
})
