import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import {dirname, join, resolve} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cesiumBuild = resolve(__dirname, './node_modules/cesium/Build/Cesium');

const isDev = process.env.NODE_ENV !== 'production';

const presets = [
  [
    '@babel/preset-typescript',
    {
      allowDeclareFields: true,
    }
  ],
  [
    '@babel/preset-env', {
    'useBuiltIns': 'entry',
    'corejs': {
      'version': 3
    },
    'targets': {
      'browsers': ['chrome 94']
    }
  }
  ]
];

const plugins = [
  ['@babel/plugin-proposal-decorators', {decoratorsBeforeExport: true, version: '2023-05'}],
];

const config = {
  context: __dirname,
  mode: isDev ? 'development' : 'production',
  cache: isDev ? {type: 'filesystem'} : false,
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      cesium: resolve(__dirname, 'node_modules/cesium'),
      // we need the aliases below for CSS :( don't know why
      './cesium/Build': resolve(__dirname, 'node_modules/cesium/Build'),
      './cesium': resolve(__dirname, 'node_modules/cesium/Source'),

      './fomantic-ui-css': resolve(__dirname, 'node_modules/fomantic-ui-css'),
      './images': resolve(__dirname, 'src/images'),
      './@fontsource/inter': resolve(__dirname, 'node_modules@fontsource/inter'),
    },
  },
  output: {
    path: resolve(__dirname, 'dist'),
    filename: 'index.js',
  },
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      },
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre'
      },
      {
        test: /\.(png|jpe?g|gif|svg|ttf|woff2|woff|eot)$/i,
        type: 'asset',
      },
      {
        test: /\.css$/i,
        //use: [isDev ? "style-loader" : MiniCssExtractPlugin.loader, 'css-loader'],
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: presets,
            plugins: plugins,
            sourceMaps: true,
            assumptions: {
              setPublicClassFields: true
            },
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  // Ignore source-map-loader warnings.
  // These are generated for
  ignoreWarnings: [/Failed to parse source map from '\/app\/ui\/node_modules\/autolinker\//],
  watchOptions: {
    poll: true
  },
  devServer: {
    static: {
      directory: join(__dirname, 'dist'),
    },
    proxy: [
      {
        context: ['/api'],
        target: 'http://api:3000',
        logLevel: 'debug',
      },
      {
        context: ['/abbr'],
        target: 'http://abbreviator:8080',
        pathRewrite: {
          '^/abbr': ''
        },
        logLevel: 'debug'
      }
    ],
    compress: true,
    port: 8000,
    hot: true,
    devMiddleware: {
      writeToDisk: true, // Enable writing to disk
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // // FIXME: is there a less ugly way to write these rules?
        {from: resolve(cesiumBuild, 'Workers'), to: './Workers',},
        {from: resolve(cesiumBuild, 'ThirdParty'), to: '/.ThirdParty',},
        {from: resolve(cesiumBuild, 'Assets'), to: './Assets',},
        {from: resolve(cesiumBuild, 'Widgets'), to: './Widgets',},
        {from: 'index.html', to: './'},
        {from: 'src/', to: 'src/'},
        {from: 'locales/', to: './locales/'},
        {from: 'src/images/', to: './images/'},
        {from: 'node_modules/@fontsource/inter/files/*', to: 'fonts/[name][ext]'},
        {from: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', to: 'fonts/[name][ext]'},
        {from: 'manuals/dist/', to: './manuals/'},
        {from: 'manuals/style.css', to: './manuals/'},
        {from: 'manuals/images', to: './manuals/images/'},
      ]
    }),
    new MiniCssExtractPlugin({
      filename: 'index.css'
    }),
    new BundleAnalyzerPlugin(),
  ],
  optimization: {
    sideEffects: false,
    usedExports: false,
  },
};
export default config;
