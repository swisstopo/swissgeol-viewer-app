import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {terser} from "rollup-plugin-terser";
import copy from 'rollup-plugin-copy'
import babel from 'rollup-plugin-babel';
import serve from 'rollup-plugin-serve'


const config = {
  input: 'src/index.js',
  output: [
  {
    file: 'dist/bundle.debug.js',
    sourcemap: true,
    format: 'esm',
  },
  {
    file: 'dist/bundle.min.js',
    sourcemap: true,
    format: 'esm',
    plugins: [
      terser(),
    ]
  }],
  plugins: [
    resolve(),
    commonjs(),
    copy({
      targets: [
        { src: 'index.html', dest: 'dist/' },
        { src: 'src', dest: 'dist/' }
      ]
    }),
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
      ]
    //  exclude: 'node_modules/**'
    }),
  ],
};

if (process.env.SERVE) {
  config.plugins.push(serve({
    contentBase: 'dist',
    port: 8000
  }));
}


export default config;
