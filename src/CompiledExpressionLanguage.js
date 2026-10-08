import Parser, {IGNORE_UNKNOWN_VARIABLES, SEMANTICS_JS} from "./Parser";
import {tokenize} from "./Lexer";
import Compiler from "./Compiler";
import PhpCompiler from "./PhpCompiler";
import CompileRuntime from "./CompileRuntime";
import LogicException from "./LogicException";
import SyntaxError from "./SyntaxError";
import {phpExport} from "./lib/phpExport";
import {shortHash} from "./lib/hash";

const FORMAT_VERSION = 1;
const TARGETS = ['js', 'php'];
const JS_FORMATS = ['esm', 'cjs', 'expression'];

// Variables that cannot be assigned as PHP locals (or that would clobber a superglobal)
const PHP_RESERVED_VARIABLES = ['this', 'GLOBALS', '_SERVER', '_GET', '_POST', '_FILES', '_COOKIE', '_SESSION', '_REQUEST', '_ENV'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isParsed = (expression) => null !== expression && typeof expression === 'object' && typeof expression.getNodes === 'function';

/**
 * Decorates an ExpressionLanguage to evaluate and lint the expressions it compiled ahead of time, without parsing them.
 *
 * `dumpCompiled()` turns a list of expressions into a source file; handing the loaded file back to this class makes
 * `evaluate()` run the generated code instead of walking the node tree. An expression that is not in the file, or whose
 * variables are not all provided, is handled by the decorated ExpressionLanguage as usual.
 *
 * The file is JavaScript by default, since that is where this class runs. It can also be PHP, in the exact format
 * Symfony's own CompiledExpressionLanguage loads: build the expressions once, ship the matching file to each runtime.
 *
 * @example
 *   const language = new CompiledExpressionLanguage(new ExpressionLanguage());
 *   const source = language.dumpCompiled(['price * quantity > 100', 'user.age >= 18']);   // write it to a file at build time...
 *
 *   import compiled from './expressions.compiled.js';                                     // ...import it at runtime
 *   const fast = new CompiledExpressionLanguage(new ExpressionLanguage(), compiled);
 *   fast.evaluate('price * quantity > 100', {price: 10, quantity: 11});
 */
export default class CompiledExpressionLanguage {
    /**
     * @param {ExpressionLanguage} expressionLanguage The language every call delegates to (or falls back to)
     * @param {Object|string|null} compiled What `dumpCompiled()` produced, once loaded (the module's default export), or
     *        the source of a dump made with `format: 'expression'`
     */
    constructor(expressionLanguage, compiled = null) {
        this.expressionLanguage = expressionLanguage;
        this.compiledExpressions = new Map();

        if (null !== compiled) {
            this.loadCompiled(typeof compiled === 'string' ? CompiledExpressionLanguage.load(compiled) : compiled);
        }
    }

    /**
     * Evaluates the source of a dump made with `format: 'expression'` and returns the object to give to the constructor.
     *
     * This runs the code of the dump, so only ever load a dump you produced yourself.
     *
     * @param {string} source
     * @returns {Object}
     */
    static load(source) {
        return new Function('return ' + source + ';')();
    }

    get functions() {
        return this.expressionLanguage.functions;
    }

    compile = (expression, names = []) => {
        return this.expressionLanguage.compile(expression, names);
    };

    parse = (expression, names = [], flags = 0) => {
        return this.expressionLanguage.parse(expression, names, flags);
    };

    register = (name, compiler, evaluator, phpCompiler = null) => {
        this.expressionLanguage.register(name, compiler, evaluator, phpCompiler);
    };

    addFunction = (expressionFunction) => {
        this.expressionLanguage.addFunction(expressionFunction);
    };

    registerProvider = (provider) => {
        this.expressionLanguage.registerProvider(provider);
    };

    /**
     * Evaluates an expression, running its compiled code when it has some.
     *
     * The compiled code is plain JavaScript, so it is more lenient than `ExpressionLanguage#evaluate()` about what it
     * reads: a property of a number, say, is `null` rather than an error, and an error that does occur (a property of
     * null) is JavaScript's own TypeError. It is never caught and the expression is never evaluated a second time, so the
     * functions you registered and the methods of your values only run once. A result that would be `undefined` is `null`.
     *
     * @param {Expression|string} expression
     * @param {Object} values
     * @returns {*}
     */
    evaluate = (expression, values = {}) => {
        // a ParsedExpression holds its own nodes, and the rules it was parsed with: they, not the compiled code, are evaluated
        const compiled = isParsed(expression) ? undefined : this.compiledExpressions.get(String(expression));
        if (undefined === compiled) {
            return this.expressionLanguage.evaluate(expression, values);
        }

        const [evaluator, variables] = compiled;

        // the expression was compiled without knowing which variables would be valid:
        // when one is missing, evaluating it again reports the error the way it always did
        for (const [name, cursor] of variables) {
            if (null === cursor) {
                break;
            }

            if (!hasOwn(values, name)) {
                return this.expressionLanguage.evaluate(expression, values);
            }
        }

        return evaluator(values, this.expressionLanguage.functions, CompileRuntime);
    };

    /**
     * Validates the syntax of an expression, without parsing it when it was compiled.
     */
    lint = (expression, names = [], flags = 0) => {
        const compiled = isParsed(expression) ? undefined : this.compiledExpressions.get(String(expression));
        if (undefined === compiled) {
            this.expressionLanguage.lint(expression, names, flags);

            return;
        }

        if ((flags | this.expressionLanguage.defaultFlags) & IGNORE_UNKNOWN_VARIABLES) {
            return;
        }

        // a name can be given as `{compiledName: expressionName}`: both spellings are valid, like for the parser
        const valid = new Set();
        for (const name of names) {
            if (name !== null && typeof name === 'object') {
                valid.add(Object.keys(name)[0]);
                valid.add(Object.values(name)[0]);
            } else {
                valid.add(name);
            }
        }

        // variables are sorted by the position where they're first read without "??", like the parser meets them
        for (const [name, cursor] of compiled[1]) {
            if (null === cursor) {
                return;
            }

            if (!valid.has(name)) {
                throw new SyntaxError(`Variable "${name}" is not valid`, cursor, String(expression), name, names);
            }
        }
    };

    /**
     * Compiles expressions to the source of a file that the constructor can load.
     *
     * The expressions this file holds are then evaluated and linted without being parsed.
     * A function whose compiler throws is called through its evaluator.
     * The expressions that cannot be compiled (a syntax error, an unknown function...) are left out.
     *
     * The dump is made with the options of the decorated language (such as `caseInsensitiveStringOperators` or `semantics`),
     * and a JavaScript dump refuses to be loaded by a language that has other ones. A PHP dump cannot follow the "js" semantics:
     * the file runs with PHP's rules.
     *
     * @param {Iterable<Expression|string>} expressions
     * @param {Object} options
     * @param {'js'|'php'} options.target The language of the generated code (default: 'js')
     * @param {'esm'|'cjs'|'expression'} options.format How a JavaScript dump is packaged (default: 'esm'):
     *        an ES module (`export default`), a CommonJS module (`module.exports`), or a bare object expression
     *        for `CompiledExpressionLanguage.load()`. Ignored for PHP.
     * @returns {string} The source code
     */
    dumpCompiled = (expressions, {target = 'js', format = 'esm'} = {}) => {
        if (TARGETS.indexOf(target) === -1) {
            throw new LogicException(`Unknown target "${target}": use ${TARGETS.map((t) => `"${t}"`).join(' or ')}.`);
        }
        if ('js' === target && JS_FORMATS.indexOf(format) === -1) {
            throw new LogicException(`Unknown format "${format}": use ${JS_FORMATS.map((f) => `"${f}"`).join(', ')}.`);
        }

        if ('php' === target && (this.expressionLanguage.defaultFlags & SEMANTICS_JS)) {
            throw new LogicException('A PHP file always runs with PHP\'s rules, which are not those of the "js" semantics: dump the PHP with a language using the "symfony" (the default) or "portable" semantics.');
        }

        const entries = [];
        const seen = new Set();
        for (const expression of expressions) {
            const key = String(expression);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);

            const entry = 'php' === target ? this.compileToPhp(key) : this.compileToJs(key);
            if (null !== entry) {
                entries.push(entry);
            }
        }

        return 'php' === target ? this.packagePhp(entries) : this.packageJs(entries, format);
    };

    // ------------------------------------------------------------------------------------------------------------
    // loading
    // ------------------------------------------------------------------------------------------------------------

    loadCompiled(compiled) {
        if (!compiled || typeof compiled !== 'object' || compiled.format !== FORMAT_VERSION || !Array.isArray(compiled.expressions)) {
            throw new LogicException('The compiled expressions are not valid: pass what dumpCompiled() generated for the "js" target.');
        }

        const flags = this.expressionLanguage.defaultFlags;
        if (compiled.flags !== flags) {
            throw new LogicException(`The compiled expressions were generated with the parser flags ${compiled.flags}, but this language uses ${flags}: dump them again.`);
        }

        for (const [expression, evaluator, variables] of compiled.expressions) {
            this.compiledExpressions.set(expression, [evaluator, variables]);
        }
    }

    // ------------------------------------------------------------------------------------------------------------
    // dumping
    // ------------------------------------------------------------------------------------------------------------

    /**
     * Parses an expression without knowing its variables. Returns null when it cannot be compiled.
     */
    parseForDump(expression) {
        const parser = new Parser(this.expressionLanguage.functions);
        try {
            const nodes = parser.parse(tokenize(expression), [], IGNORE_UNKNOWN_VARIABLES | this.expressionLanguage.defaultFlags);
            const variables = Object.entries(parser.getVariables());
            // sorted by the position where they're first read without "??", the ones only ever guarded by "??" last
            variables.sort(([, a], [, b]) => (a ?? Infinity) - (b ?? Infinity));

            return {nodes, variables};
        } catch (e) {
            return null;
        }
    }

    compileToJs(expression) {
        const parsed = this.parseForDump(expression);
        if (null === parsed) {
            return null;
        }
        const {nodes, variables} = parsed;

        const functions = {};
        for (const name of Object.keys(this.expressionLanguage.functions)) {
            const fn = this.expressionLanguage.functions[name];
            functions[name] = {
                ...fn,
                compiler: (...args) => {
                    try {
                        return fn.compiler(...args);
                    } catch (e) {
                        return `functions[${JSON.stringify(name)}].evaluator(values${args.map((arg) => ', ' + arg).join('')})`;
                    }
                },
            };
        }

        // "$" cannot start a name of the language, so a prefixed variable can never clash with a keyword or a global
        // (`class`, `String`, `Math`...) nor with the parameters of the generated function
        this.renameVariables(nodes, (name) => '$' + name);

        let source;
        try {
            source = new Compiler(functions).compile(nodes).getSource();
        } catch (e) {
            return null;
        }

        // only own properties are values: `values["toString"]` of an object that does not hold one is not a value
        const body = variables.length === 0 ? '' : '    var hasOwn = Object.prototype.hasOwnProperty;\n'
            + variables.map(([name]) => `    var $${name} = hasOwn.call(values, ${JSON.stringify(name)}) ? values[${JSON.stringify(name)}] : undefined;\n`).join('');

        return {
            expression,
            variables,
            // the same wrapper for every expression, so that the dump reads like a table of small functions
            code: `function (values, functions, __runtime) {\n${body}${variables.length ? '\n' : ''}    return (${source}) ?? null;\n}`,
        };
    }

    packageJs(entries, format) {
        const flags = this.expressionLanguage.defaultFlags;
        const rows = entries.map(({expression, code, variables}) => `        [${JSON.stringify(expression)}, ${code.replace(/\n(?=[^\n])/g, '\n        ')}, ${JSON.stringify(variables)}]`);
        const object = `{\n    format: ${FORMAT_VERSION},\n    flags: ${flags},\n    expressions: [${rows.length ? '\n' + rows.join(',\n') + ',\n    ' : ''}],\n}`;

        const header = '// This file has been auto-generated by the expression-language package. Do not edit it.\n\n';
        switch (format) {
            case 'cjs':
                return `${header}module.exports = ${object};\n`;
            case 'expression':
                return `(${object})`;
            default:
                return `${header}export default ${object};\n`;
        }
    }

    compileToPhp(expression) {
        const parsed = this.parseForDump(expression);
        if (null === parsed) {
            return null;
        }
        const {nodes, variables} = parsed;
        const names = new Set(variables.map(([name]) => name));

        // `$this` and the superglobals cannot be assigned: they get a free name instead
        const locals = new Map();
        for (const [name] of variables) {
            let local = name;
            if (PHP_RESERVED_VARIABLES.indexOf(name) !== -1) {
                do {
                    local += '_';
                } while (names.has(local));
            }
            locals.set(name, local);
        }
        this.renameVariables(nodes, (name) => locals.get(name) ?? name);

        // the parameters of the generated method must not be shadowed by a variable of the expression
        const uniqueName = (base) => {
            while (locals.has(base) || [...locals.values()].indexOf(base) !== -1) {
                base += '_';
            }

            return base;
        };
        const valuesVariable = uniqueName('values');
        const functionsVariable = uniqueName('functions');

        let source, usesFunctions;
        try {
            const compiler = new PhpCompiler(this.expressionLanguage.functions, {valuesVariable, functionsVariable});
            source = compiler.compile(nodes).getSource();
            usesFunctions = compiler.usesFunctions;
        } catch (e) {
            return null;
        }

        const params = `array $${valuesVariable}` + (usesFunctions ? `, array $${functionsVariable}` : '');
        const assignments = variables.map(([name]) => `            $${locals.get(name)} = $${valuesVariable}[${phpExport(name)}] ?? null;\n`).join('');

        return {
            expression,
            variables,
            usesFunctions,
            params,
            body: `${assignments}${assignments ? '\n' : ''}            return ${source};`,
        };
    }

    packagePhp(entries) {
        if (entries.length === 0) {
            return "<?php\n\nreturn [];\n";
        }

        const methods = entries.map((entry, index) => `        public static function e${index}(${entry.params}): mixed\n        {\n${entry.body}\n        }\n`).join('\n');
        const namespace = 'ExpressionLanguage' + shortHash(methods);

        let code = `<?php\n\n// This file has been auto-generated by the expression-language package (Symfony ExpressionLanguage compatible).\n\nnamespace ${namespace};\n\n`;
        code += `if (!\\class_exists(CompiledExpressions::class, false)) {\n    final class CompiledExpressions\n    {\n${methods}    }\n}\n\nreturn [\n`;

        entries.forEach((entry, index) => {
            const variables = '[' + entry.variables.map(([name, cursor]) => `${phpExport(name)} => ${phpExport(cursor)}`).join(', ') + ']';
            code += `    ${phpExport(entry.expression)} => [${phpExport(namespace + '\\CompiledExpressions::e' + index)}, ${variables}, ${entry.usesFunctions ? 'true' : 'false'}],\n`;
        });

        return code + "];\n";
    }

    /**
     * Renames the variables of a node tree in place.
     *
     * A node can sit at several places of the tree (`a ?: b` reuses `a`), hence the set of the ones already renamed.
     */
    renameVariables(node, rename, renamed = new Set()) {
        if (renamed.has(node)) {
            return;
        }
        renamed.add(node);

        if ((node.name === 'NameNode' || node.name === 'NullCoalescedNameNode') && typeof node.attributes.name === 'string') {
            node.attributes.name = rename(node.attributes.name);
        }

        for (const child of Object.values(node.nodes)) {
            this.renameVariables(child, rename, renamed);
        }
    }
}
