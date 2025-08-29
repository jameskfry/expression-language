import {tokenize} from "./Lexer";
import Parser, {IGNORE_UNKNOWN_VARIABLES} from "./Parser";
import Compiler from "./Compiler";
import ParsedExpression from "./ParsedExpression";
import ArrayAdapter from "./Cache/ArrayAdapter";
import LogicException from "./LogicException";
import ExpressionFunction from "./ExpressionFunction";

export default class ExpressionLanguage {
    constructor(cache = null, providers = []) {
        this.functions = [];
        this.lexer = null;
        this.parser = null;
        this.compiler = null;

        this.cache = cache || new ArrayAdapter();

        this._registerBuiltinFunctions();

        for (let provider of providers) {
            this.registerProvider(provider);
        }
    }

    /**
     * Compiles an expression source code.
     *
     * @param {Expression|string} expression The expression to compile
     * @param {Array} names An array of valid names
     *
     * @returns {string} The compiled javascript source code
     */
    compile = (expression, names = []) => {
        return this.getCompiler().compile(this.parse(expression, names).getNodes()).getSource();
    };

    /**
     * Evaluate an expression
     *
     * @param {Expression|string} expression The expression to compile
     * @param {Object} values An array of values
     *
     * @returns {*} The result of the evaluation of the expression
     */
    evaluate = (expression, values = {}) => {
        return this.parse(expression, Object.keys(values)).getNodes().evaluate(this.functions, values);
    };

    /**
     * Parses an expression
     *
     * @param {Expression|string} expression The expression to parse
     * @param {Array} names An array of valid names
     * @param {int} flags
     * @returns {ParsedExpression} A ParsedExpression instance
     */
    parse = (expression, names, flags=0) => {
        if (expression instanceof ParsedExpression) {
            return expression;
        }

        names.sort((a, b) => {
            let a_value = a,
                b_value = b;
            if (typeof a === "object") {
                a_value = Object.values(a)[0];
            }
            if (typeof b === "object") {
                b_value = Object.values(b)[0];
            }

            return a_value.localeCompare(b_value);
        });

        let cacheKeyItems = [];
        for (let name of names) {
            let value = name;
            if (typeof name === "object") {
                let tmpName = Object.keys(name)[0],
                    tmpValue = Object.values(name)[0];

                value = tmpName + ":" + tmpValue;
            }

            cacheKeyItems.push(value);
        }
        let cacheItem = this.cache.getItem(this.fixedEncodeURIComponent(expression + "//" + cacheKeyItems.join("|"))),
            parsedExpression = cacheItem.get();
        if (null === parsedExpression) {
            let nodes = this.getParser().parse(this.getLexer().tokenize(expression), names, flags);
            parsedExpression = new ParsedExpression(expression, nodes);

            cacheItem.set(parsedExpression);
            this.cache.save(cacheItem);
        }

        return parsedExpression;
    };

    lint = (expression, names=null, flags=0) => {
        if (null === names) {
            console.log("Deprecated: passing \"null\" as the second argument of lint is deprecated, pass IGNORE_UNKNOWN_VARIABLES instead as the third argument");
            flags |= IGNORE_UNKNOWN_VARIABLES;
            names = [];
        }

        if (expression instanceof ParsedExpression) {
            return;
        }

        // Ensure parser is initialized and pass names/flags to parser.lint
        this.getParser().lint(this.getLexer().tokenize(expression), names, flags);
    }

    fixedEncodeURIComponent = (str) => {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16);
        });
    };

    /**
     * Registers a function
     *
     * @param {string} name The function name
     * @param {function} compiler A function able to compile the function
     * @param {function} evaluator A function able to evaluate the function
     *
     * @throws Error
     *
     * @see ExpressionFunction
     */
    register = (name, compiler, evaluator) => {
        if (null !== this.parser) {
            throw new LogicException("Registering functions after calling evaluate(), compile(), or parse() is not supported.")
        }

        this.functions[name] = {compiler: compiler, evaluator: evaluator};
    };

    addFunction = (expressionFunction) => {
        this.register(expressionFunction.getName(), expressionFunction.getCompiler(), expressionFunction.getEvaluator());
    };

    registerProvider = (provider) => {
        for (let fn of provider.getFunctions()) {
            this.addFunction(fn);
        }
    };

    _registerBuiltinFunctions() {
        const minFn = ExpressionFunction.fromJavascript('Math.min', 'min');
        const maxFn = ExpressionFunction.fromJavascript('Math.max', 'max');
        this.addFunction(minFn);
        this.addFunction(maxFn);

        // PHP-like constant(name): resolves a global/dotted path from globalThis (or window/global)
        this.addFunction(new ExpressionFunction('constant',
            function compiler(constantName) {
                // Compile to an IIFE that resolves from global object, supporting dotted paths (e.g., "Math.PI")
                return `(function(__n){var __g=(typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:(typeof global!=='undefined'?global:{})));return __n.split('.')`+
                    `.reduce(function(o,k){return o==null?undefined:o[k];}, __g)})(${constantName})`;
            },
            function evaluator(values, constantName) {
                if (typeof constantName !== 'string' || !constantName) {
                    return undefined;
                }
                const getGlobal = () => (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
                const resolvePath = (root, path) => {
                    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), root);
                };

                // First try global resolution (supports dotted path like Math.PI)
                let resolved = resolvePath(getGlobal(), constantName);

                // As a convenience, also allow constants supplied in the evaluation values map by exact name
                if (resolved === undefined && values && Object.prototype.hasOwnProperty.call(values, constantName)) {
                    resolved = values[constantName];
                }

                return resolved;
            }
        ));

        // PHP-like enum(FQN::CASE): resolves a namespaced path from global object
        this.addFunction(new ExpressionFunction('enum',
            function compiler(enumName) {
                // normalize separators ('.', '\\', '::') into path segments without using regex
                return `(function(__n){var __g=(typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:(typeof global!=='undefined'?global:{})));`+
                    `if(typeof __n!=='string'||!__n)return undefined;`+
                    `var s=String(__n);var keys=[],buf='';`+
                    `for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);`+
                    `if(c===46||c===92){if(buf){keys.push(buf);buf='';}continue;}`+
                    `if(c===58){if(i+1<s.length&&s.charCodeAt(i+1)===58){if(buf){keys.push(buf);buf='';}i++;continue;}}`+
                    `buf+=s[i];}`+
                    `if(buf)keys.push(buf);`+
                    `return keys.reduce(function(o,k){return o==null?undefined:o[k];}, __g)})(${enumName})`;
            },
            function evaluator(values, enumName) {
                if (typeof enumName !== 'string' || !enumName) {
                    return undefined;
                }
                const getGlobal = () => (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
                const normalize = (s) => {
                    // Replace single backslashes and double-colon with dots
                    return String(s).replace(/\\/g, '.').replace(/::/g, '.');
                };
                const resolvePath = (root, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), root);
                const normalized = normalize(enumName);
                if (!normalized) return undefined;
                return resolvePath(getGlobal(), normalized);
            }
        ));
    }

    getLexer = () => {
        if (null === this.lexer) {
            this.lexer = {
                tokenize: tokenize
            };
        }

        return this.lexer;
    }

    getParser = () => {
        if (null === this.parser) {
            this.parser = new Parser(this.functions);
        }

        return this.parser;
    };

    getCompiler = () => {
        if (null === this.compiler) {
            this.compiler = new Compiler(this.functions);
        }
        return this.compiler.reset();
    }
}