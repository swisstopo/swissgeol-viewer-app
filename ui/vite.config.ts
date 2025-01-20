import {defineConfig, normalizePath, PluginOption} from 'vite';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import * as fs from "node:fs";


const __dirname = dirname(fileURLToPath(import.meta.url));
const cesiumBuild = resolve(__dirname, './node_modules/cesium/Build/Cesium');


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
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
      },
    },
    cssCodeSplit: true
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
    cssAsStringPlugin(),
    viteStaticCopy({
      targets: [
        {src: normalizePath(resolve(cesiumBuild, 'Workers')), dest: './Workers',},
        {src: normalizePath(resolve(cesiumBuild, 'ThirdParty')), dest: '/.ThirdParty',},
        {src: normalizePath(resolve(cesiumBuild, 'Assets')), dest: './Assets',},
        {src: normalizePath(resolve(cesiumBuild, 'Widgets')), dest: './Widgets',},
        {src: 'index.html', dest: './'},
        {src: 'src/', dest: 'src/'},
        {src: 'locales/', dest: './locales/'},
        {src: 'src/images/', dest: './images/'},
        {src: 'node_modules/@fontsource/inter/files/*', dest: 'fonts/[name][ext]'},
        {src: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', dest: 'fonts/[name][ext]'},
        {src: 'manuals/dist/', dest: './manuals/'},
        {src: 'manuals/style.css', dest: './manuals/'},
        {src: 'manuals/images', dest: './manuals/images/'},
      ],
      hook: 'buildEnd',
    }),
  ],
  // css: {
  //   preprocessorOptions: {
  //     // Add preprocessors if needed, otherwise leave empty
  //   },
  // },

  // optimizeDeps: {
  // },
  optimizeDeps: {
    exclude: ['fomantic-ui-css'], // Ensure Vite skips optimizing Fomantic CSS
  },
});
