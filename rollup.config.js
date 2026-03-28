const path = require('path')
const babel = require('@rollup/plugin-babel').babel
const resolve = require('@rollup/plugin-node-resolve').nodeResolve
const commonjs = require('@rollup/plugin-commonjs').default

module.exports = {
  input: path.resolve(__dirname, 'index.js'),
  output: {
    file: path.resolve(__dirname, 'dist/SAM.js'),
    format: 'umd',
    name: 'tp'
  },
  plugins: [
    resolve(),
    commonjs({ include: 'node_modules/**' }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
      configFile: false,
      babelrc: false,
      presets: [['@babel/preset-env', { targets: 'Chrome >= 80, Firefox >= 75, Safari >= 13.1, Node >= 14' }]],
      plugins: [
        '@babel/plugin-transform-optional-chaining',
        '@babel/plugin-transform-nullish-coalescing-operator'
      ]
    })
  ]
}
