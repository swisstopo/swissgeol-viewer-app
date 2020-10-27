import path from 'path';

import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import {terser} from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';
import babel from 'rollup-plugin-babel';
import postcss from 'rollup-plugin-postcss';
import inlinesvg from 'postcss-inline-svg';
import cssimport from 'postcss-import';
import postcssurl from 'postcss-url';
import autoprefixer from 'autoprefixer';
// import rollupStripPragma from 'rollup-plugin-strip-pragma';

const cesiumSource = __dirname + '/node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

const config = {
  input: 'src/index.js',
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
    // {
    //   transform ( code, id ) {
    //     console.log( id );
    //     //console.log( code );
    //     // not returning anything, so doesn't affect bundle
    //   }
    // },
    // disabled since it breaks sourcemaps
    // rollupStripPragma({
    //   pragmas: ['debug']
    // }),
    resolve({
      browser: true,
    }),
    commonjs(),
    copy({
      targets: [
        { src: 'index.html', dest: 'dist/' },
        { src: 'src', dest: 'dist/' },
        { src: 'locales', dest: 'dist/' },
        { src: 'robots.txt', dest: 'dist/' },
        { src: cesiumSource + '/' + cesiumWorkers, dest: 'dist/' },
        { src: cesiumSource + '/Assets', dest: 'dist/' },
        { src: cesiumSource + '/Widgets', dest: 'dist/' },
        { src: cesiumSource + '/ThirdParty/', dest: 'dist/' },
        { src: 'src/images', dest: 'dist/' },
        { src: 'node_modules/typeface-source-sans-pro/files/*', dest: 'dist/fonts/' },
        { src: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', dest: 'dist/fonts/' },
        { src: 'node_modules/@webcomponents/webcomponentsjs/*', dest: 'dist/webcomponentsjs/' },
        { src: 'manuals/dist/*', dest: 'dist/manuals/' },
        { src: 'manuals/images/', dest: 'dist/manuals/' },
        { src: 'manuals/style.css', dest: 'dist/manuals/' },
      ]
    }),

  ],
};

if (process.env.mode === 'production') {
  config.plugins.push(...[
    babel({
      externalHelpers: false,
      babelrc: false,
      presets: [
        [
          '@babel/preset-env', {
            //debug: true, // disable to get debug information
            modules: false,
            useBuiltIns: 'usage', // required to determine list of polyfills according to browserlist
            corejs: { version: 3, proposals: false },
          }
        ]
      ],
      // exclude: 'node_modules/**'
      exclude: ['node_modules/cesium/**', 'node_modules/core-js/**', 'node_modules/@babel/**'],
    }),

  ]);

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
