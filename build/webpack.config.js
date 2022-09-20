const path = require('path');
const webpack = require('webpack');

const isProduction = process.env.NODE_ENV == 'production';

const config = {
  entry: './toda.js',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'toda.dist.js',
    library: 'toda',
  },
  devServer: {
    open: true,
    host: 'localhost',
  },
  externals: {
    '@peculiar/webcrypto': '@peculiar/webcrypto'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        loader: 'babel-loader',
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        type: 'asset',
      }
    ]
  },
  target: 'node'
};

const webConfig = {
  ...config,
  target: 'web',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'toda.web.dist.js',
    library: 'toda',
  },
  resolve: {
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve("crypto-browserify"),
      fs: false,
      stream: require.resolve("stream-browserify")
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ]
};

module.exports = () => {
  if (isProduction) {
    config.mode = webConfig.mode = 'production';
  } else {
    config.mode = webConfig.mode = 'development';
  }

  return [config, webConfig];
};
