import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import {resolve, dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cesiumSource = __dirname + '/node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';
const devMode = process.env.NODE_ENV !== 'production';


const presets = [
  '@babel/preset-typescript',
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
],
plugins = [
  '@babel/plugin-proposal-nullish-coalescing-operator',
  '@babel/plugin-syntax-dynamic-import',
  '@babel/proposal-class-properties',
   ['@babel/plugin-proposal-decorators', {decoratorsBeforeExport: true, legacy: false}]
];


export default {
  mode: devMode ? 'development' : 'production',
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
    }
  },
  output: {
    filename: 'bundle.debug.js',
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
        //use: [devMode ? "style-loader" : MiniCssExtractPlugin.loader, 'css-loader'],
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: presets,
            plugins: plugins,
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  watchOptions: {
    poll: true
  },
  devServer: {
    static: {
      directory: join(__dirname, 'dist'),
    },
    compress: true,
    port: 8000,

  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // FIXME: is there a less ugly way to write these rules?
        {from: 'index.html', to: './'},
        {from: 'src/', to: 'src/'},
        {from: 'locales/', to: './locales/'},
        {from: cesiumSource + '/' + cesiumWorkers, to: 'Workers/'},
        {from: cesiumSource + '/Assets/', to: 'Assets/'},
        {from: cesiumSource + '/Widgets/', to: 'Widgets/'},
        {from: cesiumSource + '/ThirdParty/', to: 'ThirdParty/'},
        {from: 'src/images/', to: 'images/'},
        {from: 'node_modules/@fontsource/inter/files/*', to: 'fonts/[name][ext]'},
        {from: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', to: 'fonts/[name][ext]'},
        {from: 'node_modules/@webcomponents/webcomponentsjs/*', to: 'webcomponentsjs/[name][ext]'},
        {from: 'manuals/dist/', to: './manuals/'},
        {from: 'manuals/style.css', to: './manuals/'},
        {from: 'manuals/images', to: './manuals/images/'},
      ]
    }),
    new MiniCssExtractPlugin({
      filename: 'bundle.css'
    }),
  ]
};
