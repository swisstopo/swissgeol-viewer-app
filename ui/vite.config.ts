import {defineConfig, normalizePath, PluginOption} from 'vite';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import * as fs from "node:fs";
import litCss from "rollup-plugin-lit-css";
import * as postcss from "postcss";
import babel from "@rollup/plugin-babel";
import copy from "rollup-plugin-copy";
import inlinesvg from 'postcss-inline-svg';
import cssimport from 'postcss-import';
import postcssurl from 'postcss-url';


const __dirname = dirname(fileURLToPath(import.meta.url));
const cesiumBuild = resolve(__dirname, './node_modules/cesium/Build/Cesium');
const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';
const extensions = ['.ts', '.js'];


function cssAsStringPlugin(): PluginOption {
  return {
    enforce: 'pre', // Ensure this runs before other plugins
    name: 'css-as-string',
    transform(src: string, id: string) {
      if (id.endsWith('.css')) {
        console.log(`Processing CSS file in custom plugin: ${id}`);
      }
      if (id.includes('fomantic-ui-css') && id.endsWith('.css')) {
        console.log(`Transforming Fomantic CSS: ${id}`);
        const cssContent = fs.readFileSync(id, 'utf8');
        return `export default ${JSON.stringify(cssContent)};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      cesium: normalizePath(resolve(__dirname, 'node_modules/cesium')),
      './cesium/Build': normalizePath(resolve(__dirname, 'node_modules/cesium/Build')),
      './cesium': normalizePath(resolve(__dirname, 'node_modules/cesium/Source')),
      './fomantic-ui-css': normalizePath(resolve(__dirname, 'node_modules/fomantic-ui-css')),
      './images': normalizePath(resolve(__dirname, 'src/images')),
      './@fontsource/inter': normalizePath(resolve(__dirname, 'node_modules/@fontsource/inter')),
    },
    extensions: ['.ts', '.js'],
  },
  build: {
    outDir: 'dist',
    minify: "terser",
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: 'src/index.ts',
      plugins: [
        babel({
          babelHelpers: 'bundled',
          babelrc: false,
          // this is duplicated in .browserlistrc
          // https://babeljs.io/docs/en/options#targets
          targets: 'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions, Edge 18',
          plugins: [
            ['@babel/plugin-proposal-decorators', {decoratorsBeforeExport: true, version: '2023-05'}]
          ],
          presets: [
            [
              '@babel/preset-typescript',
              {
                allowDeclareFields: true,
              }
            ],
            [
              '@babel/preset-env', {
              //debug: true, // disable to get debug information
              modules: false,

              useBuiltIns: 'usage', // required to determine list of polyfills according to browserlist
              corejs: {version: 3, proposals: false},
            }
            ]
          ],
          // exclude: 'node_modules/**'
          extensions: extensions,
          exclude: [
            'node_modules/cesium/**',
            'node_modules/core-js/**',
            'node_modules/@babel/**',
            'node_modules/**' // yes, this is eXtreme excluding (includes aws-sdk)
          ],
        }),
        copy({
          targets: [
            {src: 'index.html', dest: 'dist/'},
            {src: 'src', dest: 'dist/'},
            {src: 'locales', dest: 'dist/'},
            {src: 'robots.txt', dest: 'dist/'},
            {src: 'robots_prod.txt', dest: 'dist/'},
            {src: 'security.txt', dest: 'dist/.well-known/'},
            {src: cesiumSource + '/' + cesiumWorkers, dest: 'dist/'},
            {src: cesiumSource + '/Assets', dest: 'dist/'},
            {src: cesiumSource + '/Widgets', dest: 'dist/'},
            {src: cesiumSource + '/ThirdParty/', dest: 'dist/'},
            {src: 'src/images', dest: 'dist/'},
            {src: 'node_modules/@fontsource/inter/files/*', dest: 'dist/fonts/'},
            {src: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', dest: 'dist/fonts/'},
            {src: 'manuals/dist/*', dest: 'dist/manuals/'},
            {src: 'manuals/images/', dest: 'dist/manuals/'},
            {src: 'manuals/style.css', dest: 'dist/manuals/'},
          ]
        }),
        ],
    },
  },
  server: {
    port: 8000,
    open: true,
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
    // vitePluginString({
    //   include: ['**/*.css'], // Enable string imports for CSS files
    // }),
    // stringPlugin(),
    // cssAsStringPlugin(),
    // litCss({}),
    // viteStaticCopy({
    //   targets: [
    //     {src: normalizePath(resolve(cesiumBuild, 'Workers')), dest: './Workers',},
    //     {src: normalizePath(resolve(cesiumBuild, 'ThirdParty')), dest: '/.ThirdParty',},
    //     {src: normalizePath(resolve(cesiumBuild, 'Assets')), dest: './Assets',},
    //     {src: normalizePath(resolve(cesiumBuild, 'Widgets')), dest: './Widgets',},
    //     {src: 'index.html', dest: './'},
    //     {src: 'src/', dest: 'src/'},
    //     {src: 'locales/', dest: './locales/'},
    //     {src: 'src/images/', dest: './images/'},
    //     {src: 'node_modules/@fontsource/inter/files/*', dest: 'fonts/[name][ext]'},
    //     {src: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', dest: 'fonts/[name][ext]'},
    //     {src: 'manuals/dist/', dest: './manuals/'},
    //     {src: 'manuals/style.css', dest: './manuals/'},
    //     {src: 'manuals/images', dest: './manuals/images/'},
    //   ],
    //   hook: 'buildEnd',
    // }),
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
  // optimizeDeps: {
  //   exclude: ['fomantic-ui-css'],
  // },
});
