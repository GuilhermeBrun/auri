import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    // O electron-vite não minifica por padrão. Minificado, o código da interface cai para cerca de
    // um terço e o app abre mais rápido: o Chromium não guarda o código compilado de arquivos
    // locais, então o JavaScript inteiro é lido e compilado a cada abertura.
    build: { minify: true }
  }
})
