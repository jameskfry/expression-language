import ExpressionFunction from "../ExpressionFunction";

// Helper to define a temporary global function for testing
function defineGlobalFn(name, fn) {
    const parts = name.split('.');
    let ctx = globalThis;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!ctx[seg]) ctx[seg] = {}; // create namespace as needed
        ctx = ctx[seg];
    }
    ctx[parts[parts.length - 1]] = fn;
    return () => {
        // cleanup
        ctx[parts[parts.length - 1]] = undefined;
    };
}

describe('ExpressionFunction.fromJavascript', () => {
    test('creates function from non-namespaced global function with default name and works (compile/evaluate)', () => {
        const cleanup = defineGlobalFn('myTestFn', (a, b) => a + b);
        try {
            const ef = ExpressionFunction.fromJavascript('myTestFn');
            expect(ef.getName()).toBe('myTestFn');

            const compiler = ef.getCompiler();
            const code = compiler('1', '2');
            expect(code).toBe('myTestFn(1, 2)');

            const evaluator = ef.getEvaluator();
            expect(evaluator({}, 1, 2)).toBe(3);
        } finally {
            cleanup();
        }
    });

    test('creates function from namespaced path (Math.max) when explicit expression name is provided', () => {
        const ef = ExpressionFunction.fromJavascript('Math.max', 'max');
        expect(ef.getName()).toBe('max');

        const compiler = ef.getCompiler();
        expect(compiler('1', '2', '3')).toBe('Math.max(1, 2, 3)');

        const evaluator = ef.getEvaluator();
        expect(evaluator({}, 1, 3, 2)).toBe(3);
    });

    test('throws if function does not exist', () => {
        expect(() => ExpressionFunction.fromJavascript('nonExistentFnXYZ')).toThrow(
            'JavaScript function "nonExistentFnXYZ" does not exist.'
        );
    });

    test('throws if namespaced path provided without expression name', () => {
        expect(() => ExpressionFunction.fromJavascript('Math.max')).toThrow(
            'An expression function name must be defined when JavaScript function "Math.max" is namespaced.'
        );
    });

    test('throws TypeError for invalid or empty name', () => {
        expect(() => ExpressionFunction.fromJavascript('')).toThrow(TypeError);
        expect(() => ExpressionFunction.fromJavascript(123)).toThrow(TypeError);
        expect(() => ExpressionFunction.fromJavascript(null)).toThrow(TypeError);
        expect(() => ExpressionFunction.fromJavascript(undefined)).toThrow(TypeError);
    });
});
