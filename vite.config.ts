import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const rawSupabase = env.VITE_SUPABASE_URL || 'https://puxzctsfjlztnburbplf.supabase.co';
  const supabaseTarget = (rawSupabase.startsWith('//') ? `https:${rawSupabase}` : rawSupabase)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      proxy: {
        // Forward relative Supabase endpoints to the actual Supabase project
        '/rest/v1': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/auth/v1': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/functions/v1': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/storage/v1': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
          bypass: (req) => {
            // Guarantee that /api requests are strictly proxied to the backend and never intercepted by SPA HTML fallback
            if (req.url?.startsWith('/api')) {
              return undefined;
            }
          },
        },
      },
    },
  };
});
