import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

// After the UMD wrapper sets up the namespace object (e.g. window.ExpressionLanguage = { ExpressionLanguage, Parser, ... }),
// this footer promotes the class to the global so `new ExpressionLanguage()` works directly,
// while preserving all named exports as static properties for backward compatibility.
const umdFooter = `(function(g){
  var ns=g.ExpressionLanguage;
  if(ns&&typeof ns.ExpressionLanguage==="function"){
    var EL=ns.ExpressionLanguage;
    Object.keys(ns).forEach(function(k){if(!(k in EL))EL[k]=ns[k];});
    g.ExpressionLanguage=EL;
  }
})(typeof globalThis!=="undefined"?globalThis:typeof self!=="undefined"?self:this);`;

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
        footer: umdFooter,
        globals: {
          'locutus': 'locutus'
        }
      },
      {
        name: 'ExpressionLanguage',
        file: 'dist/expression-language.min.js',
        format: 'umd',
        exports: 'named',
        footer: umdFooter,
        plugins: [terser()],
        sourcemap: true,
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