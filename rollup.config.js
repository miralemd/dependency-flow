const nodeResolve = require('rollup-plugin-node-resolve');

module.exports = {
  input: 'web/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'umd',
  },
  plugins: [
    nodeResolve(),
  ],
};
