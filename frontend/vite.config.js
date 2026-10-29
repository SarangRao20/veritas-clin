import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/extract': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/artifacts': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/analyse': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
    },
  },
})
