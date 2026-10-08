#!/usr/bin/env node
/*
 * Smoke test of a BUILT bundle: `lib/index.js` (Babel, CommonJS) or `dist/expression-language.min.js` (Rollup + Terser).
 *
 * The unit tests run on the sources. This script runs the code that is actually published, which matters because a few features
 * serialise functions with Function#toString() into the code compile() produces (a `matches` pattern known at runtime, the
 * resolver of constant() / enum()). That only works while the build leaves those functions self-contained, which a transpiler
 * or a minifier can silently stop doing.
 *
 * Usage:
 *
 *   node scripts/smoke-build.cjs lib/index.js dist/expression-language.min.js
 *
 * Exits with 1 when a check of any of the given bundles fails.
 */

const path = require('path');

const targets = process.argv.slice(2);
if (targets.length === 0) {
    console.error('Usage: node scripts/smoke-build.cjs <bundle> [<bundle>...]');
    process.exit(2);
}

function checksFor(lib) {
    globalThis.SmokeApp = {Roles: {ADMIN: 'ROLE_ADMIN'}};
    const el = new lib.ExpressionLanguage(null, [new lib.ConstantFunctionProvider(['SmokeApp.Roles.*', 'Math.PI'])]);
    // compiled code of the default semantics calls the runtime
    const run = (language, expression, names = [], values = []) =>
        new Function('__runtime', ...names, 'return ' + language.compile(expression, names) + ';')(lib.CompileRuntime, ...values);
    const throwsMatching = (callback, pattern) => {
        try {
            callback();
        } catch (e) {
            return pattern.test(e.message);
        }

        return false;
    };

    return {
        'a matches pattern known at runtime survives the build (toRegExp is serialised)': () => run(el, 's matches p', ['s', 'p'], ['ABC', '/^a/i']) === true,
        'an invalid pattern known at runtime is reported': () => throwsMatching(() => run(el, 's matches p', ['s', 'p'], ['a', 'nope']), /is not valid/),
        'constant() resolver survives the build (it is serialised)': () => run(el, 'constant("SmokeApp.Roles.ADMIN")') === 'ROLE_ADMIN',
        'compiled constant() refuses what is not allowed': () => throwsMatching(() => run(el, 'constant("process")'), /not allowed/),
        'evaluate() constant()': () => el.evaluate('constant("Math.PI")') === Math.PI,
        'constant() does not exist without a provider': () => throwsMatching(() => new lib.ExpressionLanguage().evaluate('constant("Math.PI")'), /does not exist/),
        'caseInsensitiveStringOperators option': () => new lib.ExpressionLanguage(null, [], {caseInsensitiveStringOperators: true}).evaluate('"ABC" contains "b"') === true,
        'null-safe array access': () => el.evaluate('a?.[0]', {a: null}) === null && el.evaluate('a?.[0]', {a: [4]}) === 4,
        'min / max / count': () => el.evaluate('min([3,1,2])') === 1 && el.evaluate('max(1,5)') === 5 && el.evaluate('count([1,2])') === 2,
        'semantics: Symfony\'s by default, JavaScript\'s and portable on request': () => {
            const portable = new lib.ExpressionLanguage(null, [], {semantics: 'portable'});
            const refused = throwsMatching(() => portable.evaluate('"5" + 1'), /not portable/);
            let isPortabilityError = false;
            try {
                portable.evaluate('"5" + 1');
            } catch (e) {
                isPortabilityError = e instanceof lib.PortabilityError;
            }

            return new lib.ExpressionLanguage().evaluate('"5" + 1') === 6
                && new lib.ExpressionLanguage(null, [], {semantics: 'js'}).evaluate('"5" + 1') === '51'
                && refused && isPortabilityError;
        },
        'compiled code of every semantics runs': () => ['symfony', 'js', 'portable'].every((semantics) =>
            run(new lib.ExpressionLanguage(null, [], {semantics}), 'a * b > 10 and a != b', ['a', 'b'], [3, 4]) === true),
        'CompiledExpressionLanguage: JavaScript dump, loaded and evaluated': () => {
            const providers = () => [new lib.StringProvider()];
            const source = new lib.CompiledExpressionLanguage(new lib.ExpressionLanguage(null, providers()))
                .dumpCompiled(['strtoupper(n) ~ "!"', 'a ?: b', 'x?.[0]'], {format: 'expression'});
            const compiled = new lib.CompiledExpressionLanguage(new lib.ExpressionLanguage(null, providers()), source);

            return compiled.evaluate('strtoupper(n) ~ "!"', {n: 'ab'}) === 'AB!'
                && compiled.evaluate('a ?: b', {a: 0, b: 4}) === 4
                && compiled.evaluate('x?.[0]', {x: null}) === null;
        },
        'CompiledExpressionLanguage: PHP dump': () => /return \(\$a \+ 1\.0\);/.test(new lib.CompiledExpressionLanguage(new lib.ExpressionLanguage()).dumpCompiled(['a + 1.0'], {target: 'php'})),
        'public exports': () => [
            'ExpressionLanguage', 'ConstantFunctionProvider', 'CompiledExpressionLanguage', 'PhpCompiler', 'CompileRuntime',
            'PortabilityError', 'DivisionByZeroError', 'LogicException', 'SyntaxError',
            'CASE_INSENSITIVE_STRING_OPERATORS', 'SEMANTICS_JS', 'SEMANTICS_PORTABLE',
        ].every((name) => name in lib),
    };
}

let failed = 0;
for (const target of targets) {
    const file = path.resolve(target);
    console.log(`\n${target}`);

    let lib;
    try {
        lib = require(file);
    } catch (e) {
        console.log(`  FAIL could not be loaded: ${e.message}`);
        failed++;
        continue;
    }

    for (const [name, check] of Object.entries(checksFor(lib))) {
        let ok = false;
        try {
            ok = check();
        } catch (e) {
            console.log(`  threw: ${e.message}`);
        }
        if (!ok) {
            failed++;
        }
        console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}`);
    }
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
