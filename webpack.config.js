const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const cesiumSource = __dirname + '/node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

// this is to measure how much time is spent in each webpack module
const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  resolve: {
    alias: {
      cesium: path.resolve(__dirname, 'node_modules/cesium/Source'),
      // we need the aliases below for CSS :( don't know why
      './cesium/Build': path.resolve(__dirname, 'node_modules/cesium/Build'),
      './cesium': path.resolve(__dirname, 'node_modules/cesium/Source'),
      './fomantic-ui-css': path.resolve(__dirname, 'node_modules/fomantic-ui-css'),
      './images': path.resolve(__dirname, 'src/images'),
      './typeface-source-sans-pro': path.resolve(__dirname, 'node_modules/typeface-source-sans-pro'),
    }
  },
  output: {
    filename: 'bundle.debug.js',
  },
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        enforce: "pre"
      },
      {
        test: /\.(png|jpe?g|gif|svg|ttf|woff2|woff|eot)$/i,
        use: [{loader: 'file-loader',},],
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },

  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 8000
  },
    plugins: [
      new CopyPlugin([
        // FIXME: is there a less ugly way to write these rules?
        { from: 'index.html', to: './' },
        { from: 'src/', to: 'src/' },
        { from: 'locales/', to: './locales/' },
        { from: cesiumSource + '/' + cesiumWorkers, to: 'Workers/' },
        { from: cesiumSource + '/Assets/', to: 'Assets/' },
        { from: cesiumSource + '/Widgets/', to: 'Widgets/' },
        { from: cesiumSource + '/ThirdParty/', to: 'ThirdParty/' },
        { from: 'src/images/', to: 'images/' },
        { from: 'node_modules/typeface-source-sans-pro/files/*', flatten: true, to: 'fonts/' },
        { from: 'node_modules/fomantic-ui-css/themes/default/assets/fonts/*', flatten: true, to: 'fonts/' },
        { from: 'node_modules/@webcomponents/webcomponentsjs/*', flatten: true, to: 'webcomponentsjs/' },
      ]),
      new MiniCssExtractPlugin({
        filename: 'bundle.css'
      }),
    ]
});
