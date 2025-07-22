import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default [
  // UMD build (for browsers)
  {
    input: 'src/index.js',
    output: [
      {
        name: 'ExpressionLanguage',
        file: 'dist/expression-language.js',
        format: 'umd',
        exports: 'named',
        globals: {
          'locutus': 'locutus'
        }
      },
      {
        name: 'ExpressionLanguage',
        file: pkg.browser,
        format: 'umd',
        exports: 'named',
        plugins: [terser()],
        globals: {
          'locutus': 'locutus'
        }
      }
    ],
    external: ['locutus'],
    plugins: [
      nodeResolve({
        browser: true
      }),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', {
            targets: {
              browsers: ['last 2 versions', 'not dead', '> 0.5%']
            }
          }]
        ],
        plugins: ['@babel/plugin-proposal-class-properties']
      })
    ]
  }
];