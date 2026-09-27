import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function themeToken(name: string): string {
  const css = readFileSync(fileURLToPath(new URL('../theme/theme.css', import.meta.url)), 'utf8')
  const value = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim()
  if (!value) throw new Error(`theme.css has no ${name}`)
  const inner = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  return inner ? themeToken(inner) : value
}

function installable(): Plugin {
  const background = themeToken('--color-bg')
  const manifest = {
    name: '6MW Backstage',
    short_name: '6MW',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: background,
    theme_color: background,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return {
    name: 'installable',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(JSON.stringify(manifest))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest) })
    },
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: background }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: '6MW' }, injectTo: 'head' },
    ],
  }
}

export default defineConfig({
  plugins: [vue(), vueDevTools(), installable()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth/ },
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore/ },
            { name: 'firebase', test: /node_modules[\\/](@?firebase)[\\/]/ },
            { name: 'vue', test: /node_modules[\\/](vue|@vue|vue-router|pinia)[\\/]/ },
          ],
        },
      },
    },
  },
})
