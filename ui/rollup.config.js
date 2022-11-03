import path from 'path';

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import inlinesvg from 'postcss-inline-svg';
import cssimport from 'postcss-import';
import postcssurl from 'postcss-url';
import autoprefixer from 'autoprefixer';

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';
const extensions = ['.ts', '.js'];

const config = {
  input: 'src/index.ts',
  output: [{
    file: 'dist/bundle.debug.js',
    sourcemap: true,
    format: 'esm',
  }],
  plugins: [
    postcss({
      minimize: true,
      inject: false,
      extract: 'bundle.css',
      plugins: [
        inlinesvg(),
        cssimport({
          plugins: [
            postcssurl([
              {filter: '**/*.+(woff|woff2)', url: (asset) => `fonts/${path.basename(asset.url)}`},
            ])
          ]
        }),
        autoprefixer()
      ]
    }),
    json(),
    resolve({
      extensions: extensions,
      browser: true,
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      babelrc: false,
      // this is duplicated in .browserlistrc
      // https://babeljs.io/docs/en/options#targets
      targets: 'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions, Edge 18',
      plugins: [
        ['@babel/plugin-proposal-decorators', {decoratorsBeforeExport: true, legacy: false}]
      ],
      presets: [
        '@babel/preset-typescript',
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
};

if (process.env.mode === 'production') {
  config.output.push({
    file: 'dist/bundle.min.js',
    sourcemap: true,
    format: 'esm',
    plugins: [
      terser(),
    ]
  });
}

export default config;
