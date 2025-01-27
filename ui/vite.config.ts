import { defineConfig, normalizePath } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import babel from '@rollup/plugin-babel';
import inlinesvg from 'postcss-inline-svg';
import cssimport from 'postcss-import';
import postcssurl from 'postcss-url';

// @ts-expect-error
const __dirname = dirname(fileURLToPath(import.meta.url));
const cesiumBuild = resolve(__dirname, './node_modules/cesium/Build/Cesium');
const extensions = ['.ts', '.js'];

export default defineConfig({
  resolve: {
    alias: {
      cesium: normalizePath(resolve(__dirname, 'node_modules/cesium')),
      './cesium/Build': normalizePath(
        resolve(__dirname, 'node_modules/cesium/Build'),
      ),
      './cesium': normalizePath(
        resolve(__dirname, 'node_modules/cesium/Source'),
      ),
      './fomantic-ui-css': normalizePath(
        resolve(__dirname, 'node_modules/fomantic-ui-css'),
      ),
      './@fontsource/inter': normalizePath(
        resolve(__dirname, 'node_modules/@fontsource/inter'),
      ),
      src: normalizePath(resolve(__dirname, 'src')),
    },
    extensions,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'terser',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
      plugins: [
        babel({
          babelHelpers: 'bundled',
          babelrc: false,
          // this is duplicated in .browserlistrc
          // https://babeljs.io/docs/en/options#targets
          targets:
            'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions, Edge 18',
          plugins: [
            [
              '@babel/plugin-proposal-decorators',
              { decoratorsBeforeExport: true, version: '2023-05' },
            ],
          ],
          presets: [
            [
              '@babel/preset-typescript',
              {
                allowDeclareFields: true,
              },
            ],
            [
              '@babel/preset-env',
              {
                //debug: true, // disable to get debug information
                modules: false,

                useBuiltIns: 'usage', // required to determine list of polyfills according to browserlist
                corejs: { version: 3, proposals: false },
              },
            ],
          ],
          // exclude: 'node_modules/**'
          extensions: extensions,
          exclude: [
            'node_modules/**', // yes, this is eXtreme excluding (includes aws-sdk)
          ],
        }),
      ],
    },
  },
  server: {
    hmr: {
      host: 'localhost',
    },
    watch: {
      usePolling: true,
    },
    host: '0.0.0.0',
    port: 8000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
        secure: false,
      },
      '/abbr': {
        target: 'http://abbreviator:8080',
        rewrite: (path) => path.replace(/^\/abbr/, ''),
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(resolve(cesiumBuild, 'Workers/**/*')),
          dest: './cesium/Workers',
        },
        {
          src: normalizePath(resolve(cesiumBuild, 'ThirdParty/**/*')),
          dest: './cesium/ThirdParty',
        },
        {
          src: normalizePath(resolve(cesiumBuild, 'Assets/**/*')),
          dest: './cesium/Assets',
        },
        {
          src: normalizePath(resolve(cesiumBuild, 'Widgets/**/*')),
          dest: './cesium/Widgets',
        },
        { src: 'locales/**/*', dest: './locales' },
        { src: 'node_modules/@fontsource/inter/files/**/*', dest: 'fonts' },
        {
          src: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/**/*',
          dest: 'fonts',
        },
        { src: 'manuals/dist/**/*', dest: './manuals' },
        { src: 'manuals/style.css', dest: './manuals' },
        { src: 'manuals/images/**/*', dest: './manuals/images' },
      ],
      watch: { reloadPageOnChange: true },
      hook: 'buildStart',
    }),
  ],
  css: {
    postcss: {
      plugins: [
        inlinesvg(),
        cssimport({
          plugins: [
            postcssurl([
              {
                filter: '**/*.+(woff|woff2)',
                url: (asset) => `fonts/${asset.url.split('/').pop()}`,
              },
            ]),
          ],
        }),
      ],
    },
  },
});
