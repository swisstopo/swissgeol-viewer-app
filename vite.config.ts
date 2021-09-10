import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias:  {
      cesium: resolve(__dirname, 'node_modules/cesium'),
      './cesium/Build': resolve(__dirname, 'node_modules/cesium/Build'),
      './cesium': resolve(__dirname, 'node_modules/cesium/Source'),
      "./runtimeConfig": "./runtimeConfig.browser",
    },
    mainFields: ['module', 'jsnext:main', 'jsnext']
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      }
    },
  }
})
