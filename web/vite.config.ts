import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.SAHRA_ENTRY ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: '../public',
    emptyOutDir: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: process.env.SAHRA_ENTRY === 'core'
        ? { core: path.resolve(__dirname, './core.html') }
        : process.env.SAHRA_ENTRY === 'index'
          ? { index: path.resolve(__dirname, './index.html') }
          : {
              index: path.resolve(__dirname, './index.html'),
              core: path.resolve(__dirname, './core.html'),
            },
    },
  },
})
