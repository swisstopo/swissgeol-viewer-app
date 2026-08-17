import { defineConfig, normalizePath } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import babel from '@rolldown/plugin-babel';
import inlinesvg from 'postcss-inline-svg';
import analyzer from 'vite-bundle-analyzer';
import inject from '@rollup/plugin-inject';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensions = ['.ts', '.js'];

export default defineConfig(({ command }) => ({
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
      src: normalizePath(resolve(__dirname, 'src')),
    },
    extensions,
  },
  server: {
    hmr: {
      host: 'localhost',
    },
    watch: {
      usePolling: true,
      ignored: ['dist/**', 'cypress/**', 'node_modules/**'],
    },
    host: '0.0.0.0',
    port: 8000,
    open: false,
    proxy: {
      '/api': {
        target: process.env['API_HOST'] ?? 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/abbr': {
        target: process.env['ABBREVIATOR_HOST'] ?? 'http://localhost:8001',
        rewrite: (path) => path.replace(/^\/abbr/, ''),
        changeOrigin: true,
        secure: false,
      },
      '^/aaretal/': {
        target:
          'https://download.swissgeol.ch/testvoxel/test20250919-Aaretal/2025-10-07/output/',
        rewrite: (path) => path.replace(/^\/aaretal/, ''),
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
      '^/birr/': {
        target:
          'https://download.swissgeol.ch/testvoxel/test20250919-Birr/2025-09-17/output/',
        rewrite: (path) => path.replace(/^\/birr/, ''),
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    },
  },
  // Oxc lowers class fields before super() in Babel's 2023-05 decorator wrapper classes.
  oxc: false,
  optimizeDeps: {
    include: [
      'lit',
      'i18next',
      'i18next-http-backend',
      'loc-i18next',
      '@aws-sdk/client-s3',
      '@aws-sdk/credential-provider-cognito-identity',
      'fomantic-ui-css/components/dropdown.js',
      'fomantic-ui-css/components/accordion.js',
      'fomantic-ui-css/components/toast.js',
      'fomantic-ui-css/components/transition.js',
      'fomantic-ui-css/components/dimmer.js',
      'fomantic-ui-css/components/modal.js',
      'fomantic-ui-css/components/popup.js',
      'fomantic-ui-css/components/checkbox.js',
    ],
  },
  plugins: [
    // Inject jQuery into fomantic-ui-css components that reference it as a global.
    inject({ jQuery: 'jquery', include: '**/fomantic-ui-css/**/*.js' }),
    process.env.ANALYZE === 'true' ? analyzer({ analyzerPort: 8883 }) : null,
    // Oxc does not lower 2023-05 decorators; Babel handles TS + decorators + polyfills.
    babel({
      targets:
        'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions, Edge 18',
      plugins: [
        // TypeScript must run first so decorators don't see TS `!` syntax.
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        [
          '@babel/plugin-proposal-decorators',
          { decoratorsBeforeExport: true, version: '2023-05' },
        ],
      ],
      // preset-env only during build to avoid dep-optimizer loops in dev.
      presets:
        command === 'build'
          ? [
              [
                '@babel/preset-env',
                {
                  modules: false,
                  useBuiltIns: 'usage',
                  corejs: { version: 3, proposals: false },
                },
              ],
            ]
          : [],
      exclude: [
        /[/\\]node_modules[/\\]/,
        /[/\\]cypress[/\\]/,
        /\0rolldown\/runtime\.js/,
      ],
    }),
    // Cesium and ui-core font assets are copied to public/ by scripts/copy-cesium.js.
    viteStaticCopy({
      targets: [
        { src: 'locales/**/*', dest: '.' },
        { src: 'manuals/dist/**/*', dest: './manuals' },
        { src: 'manuals/style.css', dest: './manuals' },
        { src: 'manuals/images/**/*', dest: './manuals/images' },
        {
          src: 'node_modules/@swissgeol/ui-core/dist/esm/*',
          dest: 'assets',
        },
      ],
      watch: { reloadPageOnChange: true },
    }),
  ].filter(Boolean),
  css: {
    postcss: {
      plugins: [inlinesvg()],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'terser',
    sourcemap: true,
    cssCodeSplit: true,
    // Prevent Rolldown from lowering class features in production output.
    target: 'esnext',
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
      external: ['cypress'],
    },
  },
}));
