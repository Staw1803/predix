import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api-mp': {
          target: 'https://api.mercadopago.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-mp/, ''),
          headers: {
            Authorization: `Bearer ${env.VITE_MP_ACCESS_TOKEN || 'APP_USR-c9cf66a7-a044-4859-a9ad-544598f52b76'}`
          }
        }
      }
    }
  };
});
