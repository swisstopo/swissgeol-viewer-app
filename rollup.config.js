import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {terser} from "rollup-plugin-terser";
import copy from 'rollup-plugin-copy'
import babel from 'rollup-plugin-babel';
import serve from 'rollup-plugin-serve'
import alias from '@rollup/plugin-alias';
// import rollupStripPragma from 'rollup-plugin-strip-pragma';

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

const config = {
  input: 'src/index.js',
  output: [{
    file: 'dist/bundle.debug.js',
    sourcemap: true,
    format: 'esm',
  }],
  plugins: [
    alias({
      entries: [
        {
          find: 'cesium', replacement: cesiumSource,
        }
      ]
    }),
    // disabled since it breaks sourcemaps
    // rollupStripPragma({
    //   pragmas: ['debug']
    // }),
    resolve(),
    commonjs(),
    copy({
      targets: [
        { src: 'index.html', dest: 'dist/' },
        { src: 'src', dest: 'dist/' },
        { src: cesiumSource + '/' + cesiumWorkers, dest: 'dist/' },
        { src: cesiumSource + '/Assets', dest: 'dist/'},
        { src: cesiumSource + '/Widgets', dest: 'dist/'},
        { src: cesiumSource + '/ThirdParty/', dest: 'dist/'},
      ]
    }),

  ],
};

if (process.env.SERVE) {
  config.plugins.push(serve({
    contentBase: 'dist',
    port: 8000
  }));
}

if (process.env.mode === 'production') {
  config.plugins.push(...[
    babel({
    externalHelpers: false,
    babelrc: false,
    presets: [
      [
        "@babel/preset-env",
        {
          //debug: true, // disable to get debug information
          modules: false,
          useBuiltIns: 'usage', // does it make sense?
          corejs:  { version: 2, proposals: false },
        }
      ]
    ],
     // exclude: 'node_modules/**'
   }),
  ]);

  config.output.push({
    file: 'dist/bundle.min.js',
    sourcemap: true,
    format: 'esm',
    plugins: [
      terser(),
    ]
  })
}

export default config;
