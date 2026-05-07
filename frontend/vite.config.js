import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shared': path.resolve(__dirname, '../shared'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'ui-vendor': ['framer-motion', 'lucide-react', 'recharts'],
                    'data-vendor': ['@tanstack/react-query', 'zustand', 'dexie', 'zod'],
                },
            },
        },
    },
    server: {
        proxy: {
            '/api': 'http://localhost:8787',
        },
    },
});
