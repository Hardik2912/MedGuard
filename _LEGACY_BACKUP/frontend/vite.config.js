import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5050',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            // Also proxy specific endpoints directly if they are not prefixed with /api in backend
            '/timeline': 'http://127.0.0.1:5050',
            '/medicine': 'http://127.0.0.1:5050',
            '/risk': 'http://127.0.0.1:5050',
            '/ocr': 'http://127.0.0.1:5050',
            '/amr': 'http://127.0.0.1:5050',
            '/explain': 'http://127.0.0.1:5050',
            '/health': 'http://127.0.0.1:5050',
            '/user': 'http://127.0.0.1:5050',
            '/device': 'http://127.0.0.1:5050',
        }
    }
})
