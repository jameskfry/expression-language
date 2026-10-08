import {tokenize} from "./Lexer";
import Parser, {IGNORE_UNKNOWN_VARIABLES, CASE_INSENSITIVE_STRING_OPERATORS, SEMANTICS_JS, SEMANTICS_PORTABLE, SEMANTICS_MASK} from "./Parser";
import Compiler from "./Compiler";
import ParsedExpression from "./ParsedExpression";
import ArrayAdapter from "./Cache/ArrayAdapter";
import LogicException from "./LogicException";
import ExpressionFunction from "./ExpressionFunction";
import {phpTypeName} from "./lib/phpType";
import {getSemantics} from "./Semantics";

export default class ExpressionLanguage {
    /**
     * @param {ArrayAdapter|null} cache The cache used to store parsed expressions
     * @param {Iterable<AbstractProvider>} providers Providers of extra expression functions
     * @param {Object} options
     * @param {boolean} options.caseInsensitiveStringOperators Make `contains`, `starts with` and `ends with`
     *                  ignore case. They are case-sensitive by default, like Symfony's.
     * @param {'symfony'|'js'|'portable'} options.semantics The rules operators follow where PHP and JavaScript differ
     *                  (`+`, `==`, `<`, truthiness...). "symfony" (the default): PHP's, so that an expression gives the
     *                  same result here and in Symfony. "js": JavaScript's. "portable": both, and an operation that
     *                  would not give the same result with both is a PortabilityError.
     */
    constructor(cache = null, providers = [], options = {}) {
        this.functions = [];
        this.defaultFlags = options && options.caseInsensitiveStringOperators ? CASE_INSENSITIVE_STRING_OPERATORS : 0;
        const semantics = (options && options.semantics) || 'symfony';
        getSemantics(semantics); // refuses an unknown one
        this.defaultFlags |= {symfony: 0, js: SEMANTICS_JS, portable: SEMANTICS_PORTABLE}[semantics];
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
    parse = (expression, names = [], flags=0) => {
        if (expression instanceof ParsedExpression) {
            return expression;
        }

        flags = this.mergeFlags(flags);
        // sorted on a copy: the caller's array must stay untouched
        names = [...names];
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
        let cacheItem = this.cache.getItem(this.fixedEncodeURIComponent(expression + "//" + cacheKeyItems.join("|") + (flags ? "//" + flags : ""))),
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

        flags = this.mergeFlags(flags);

        // Ensure parser is initialized and pass names/flags to parser.lint
        this.getParser().lint(this.getLexer().tokenize(expression), names, flags);
    }

    /**
     * Adds the flags of the language to those of a call. The semantics are the exception: those of the call win.
     */
    mergeFlags = (flags) => {
        if (flags & SEMANTICS_MASK) {
            return flags | (this.defaultFlags & ~SEMANTICS_MASK);
        }

        return flags | this.defaultFlags;
    };

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
     * @param {function|null} phpCompiler A function able to compile the function to PHP (see ExpressionFunction)
     *
     * @throws Error
     *
     * @see ExpressionFunction
     */
    register = (name, compiler, evaluator, phpCompiler = null) => {
        if (null !== this.parser) {
            throw new LogicException("Registering functions after calling evaluate(), compile(), or parse() is not supported.")
        }

        this.functions[name] = {compiler: compiler, evaluator: evaluator};
        if (phpCompiler) {
            this.functions[name].phpCompiler = phpCompiler;
        }
    };

    addFunction = (expressionFunction) => {
        this.register(expressionFunction.getName(), expressionFunction.getCompiler(), expressionFunction.getEvaluator(), expressionFunction.getPhpCompiler ? expressionFunction.getPhpCompiler() : null);
    };

    registerProvider = (provider) => {
        for (let fn of provider.getFunctions()) {
            this.addFunction(fn);
        }
    };

    _registerBuiltinFunctions() {
        // PHP's type name of a value, for error messages (inlined in the compiled code, hence the ternary chain)
        const typeName = '(__t===null||__t===undefined?"null":typeof __t==="number"?(Number.isInteger(__t)?"int":"float"):typeof __t==="boolean"?"bool":Array.isArray(__t)?"array":typeof __t)';

        // min() / max() accept either several values or a single array (or hash) of values, like PHP's.
        for (const [name, pick] of [['min', (a, b) => (b < a ? b : a)], ['max', (a, b) => (b > a ? b : a)]]) {
            const operator = name === 'min' ? '<' : '>';
            this.addFunction(new ExpressionFunction(
                name,
                (...args) => `(function(__a){var __t;if(__a.length===0){throw new Error("${name}() expects at least 1 argument, 0 given");}` +
                    `if(__a.length===1){__t=__a[0];if(__t===null||typeof __t!=="object"){throw new TypeError("${name}(): Argument #1 ($value) must be of type array, "+${typeName}+" given");}` +
                    `__a=Array.isArray(__t)?__t:Object.keys(__t).map(function(__k){return __t[__k];});}` +
                    `if(__a.length===0){throw new Error("${name}(): Argument #1 ($value) must contain at least one element");}` +
                    `return __a.reduce(function(__m,__x){return __x ${operator} __m ? __x : __m;});})([${args.join(', ')}])`,
                (values, ...args) => {
                    if (args.length === 0) {
                        throw new Error(`${name}() expects at least 1 argument, 0 given`);
                    }
                    if (args.length === 1) {
                        if (args[0] === null || typeof args[0] !== 'object') {
                            throw new TypeError(`${name}(): Argument #1 ($value) must be of type array, ${phpTypeName(args[0])} given`);
                        }
                        args = Array.isArray(args[0]) ? args[0] : Object.values(args[0]);
                    }
                    if (args.length === 0) {
                        throw new Error(`${name}(): Argument #1 ($value) must contain at least one element`);
                    }

                    return args.reduce(pick);
                }
            ).withPhpFunction());
        }

        // count(): number of items of an array, or of entries of a hash
        this.addFunction(new ExpressionFunction(
            'count',
            (value) => `(function(__t){if(__t===null||typeof __t!=="object"){throw new TypeError("count(): Argument #1 ($value) must be of type Countable|array, "+${typeName}+" given");}return Array.isArray(__t)?__t.length:Object.keys(__t).length;})(${value})`,
            (values, value) => {
                if (value === null || typeof value !== 'object') {
                    throw new TypeError(`count(): Argument #1 ($value) must be of type Countable|array, ${phpTypeName(value)} given`);
                }

                return Array.isArray(value) ? value.length : Object.keys(value).length;
            }
        ).withPhpFunction());
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