import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'src'),
    },
  },
})
