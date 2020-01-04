import {tokenize} from "./Lexer";
import Parser from "./Parser";
import Compiler from "./Compiler";
import ParsedExpression from "./ParsedExpression";
import ArrayAdapter from "./Cache/ArrayAdapter";
import LogicException from "./LogicException";

export default class ExpressionLanguage {
    constructor(cache = null, providers = []) {
        this.functions = [];
        this.parser = null;
        this.compiler = null;

        this.cache = cache || new ArrayAdapter();
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
     * @returns {ParsedExpression} A ParsedExpression instance
     */
    parse = (expression, names) => {
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
            let nodes = this.getParser().parse(tokenize(expression), names);
            parsedExpression = new ParsedExpression(expression, nodes);

            cacheItem.set(parsedExpression);
            this.cache.save(cacheItem);
        }

        return parsedExpression;
    };

    fixedEncodeURIComponent = (str) => {
        return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
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

    _registerFunctions() {
        // TODO figure out a way to replicate "constant" function from PHP
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