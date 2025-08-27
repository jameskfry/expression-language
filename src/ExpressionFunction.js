export default class ExpressionFunction {
    constructor(name, compiler, evaluator) {
        this.name = name;
        this.compiler = compiler;
        this.evaluator = evaluator;
    }

    getName = () => {
        return this.name;
    };

    getCompiler = () => {
        return this.compiler;
    };

    getEvaluator = () => {
        return this.evaluator;
    }

    /**
     * Creates an ExpressionFunction from a JavaScript function name (string path).
     *
     * - Supports dotted paths on globalThis (e.g., 'Math.max').
     * - If a dotted path is provided and expressionFunctionName is not defined,
     *   an error is thrown (mirrors PHP namespaced constraint).
     *
     * @param {string} javascriptFunctionName The JS function name or dotted path on globalThis
     * @param {string|null} expressionFunctionName Optional expression function name (default: last segment of the JS name)
     * @returns {ExpressionFunction}
     */
    static fromJavascript(javascriptFunctionName, expressionFunctionName = null) {
        if (typeof javascriptFunctionName !== 'string' || javascriptFunctionName.length === 0) {
            throw new TypeError('A JavaScript function name (string) must be provided.');
        }

        const fnPath = javascriptFunctionName.replace(/^\/+/, '');
        const parts = fnPath.split('.');

        // Resolve the function from globalThis following dotted path
        let ctx = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
        let resolved = ctx;
        for (const segment of parts) {
            if (resolved == null) break;
            resolved = resolved[segment];
        }

        if (typeof resolved !== 'function') {
            throw new Error(`JavaScript function "${fnPath}" does not exist.`);
        }

        if (!expressionFunctionName && parts.length > 1) {
            throw new Error(`An expression function name must be defined when JavaScript function "${fnPath}" is namespaced.`);
        }

        const compiler = (...args) => `${fnPath}(${args.join(', ')})`;
        const evaluator = (p, ...args) => resolved(...args);

        const name = expressionFunctionName || parts[parts.length - 1];
        return new this(name, compiler, evaluator);
    }
}
