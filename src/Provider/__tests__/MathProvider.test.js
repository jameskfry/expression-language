import ExpressionLanguage from "../../ExpressionLanguage";
import CompiledExpressionLanguage from "../../CompiledExpressionLanguage";
import CompileRuntime from "../../CompileRuntime";
import MathProvider from "../MathProvider";

describe('MathProvider', () => {
    let el;

    beforeEach(() => {
        el = new ExpressionLanguage(null, [new MathProvider()]);
    });

    describe('evaluate', () => {
        test('abs', () => {
            expect(el.evaluate('abs(-42)')).toBe(42);
            expect(el.evaluate('abs(42)')).toBe(42);
            expect(el.evaluate('abs(0)')).toBe(0);
        });

        test('round (PHP half-away-from-zero and precision parity)', () => {
            expect(el.evaluate('round(3.4)')).toBe(3);
            expect(el.evaluate('round(3.5)')).toBe(4);
            expect(el.evaluate('round(-3.5)')).toBe(-4);
            expect(el.evaluate('round(1.005, 2)')).toBe(1.01);
            expect(el.evaluate('round(1241757, -3)')).toBe(1242000);
            expect(el.evaluate('round(3.14159, 2)')).toBe(3.14);
            expect(el.evaluate('round(3.14159, 4)')).toBe(3.1416);
        });

        test('floor', () => {
            expect(el.evaluate('floor(3.9)')).toBe(3);
            expect(el.evaluate('floor(-3.1)')).toBe(-4);
        });

        test('ceil', () => {
            expect(el.evaluate('ceil(3.1)')).toBe(4);
            expect(el.evaluate('ceil(-3.9)')).toBe(-3);
        });

        test('pow', () => {
            expect(el.evaluate('pow(2, 8)')).toBe(256);
            expect(el.evaluate('pow(9, 0.5)')).toBe(3);
        });

        test('sqrt', () => {
            expect(el.evaluate('sqrt(144)')).toBe(12);
            expect(el.evaluate('sqrt(0)')).toBe(0);
        });

        test('clamp', () => {
            expect(el.evaluate('clamp(150, 0, 100)')).toBe(100);
            expect(el.evaluate('clamp(-50, 0, 100)')).toBe(0);
            expect(el.evaluate('clamp(42, 0, 100)')).toBe(42);
        });

        test('rand', () => {
            const val = el.evaluate('rand(10, 20)');
            expect(val).toBeGreaterThanOrEqual(10);
            expect(val).toBeLessThanOrEqual(20);
            expect(Number.isInteger(val)).toBe(true);

            const defaultVal = el.evaluate('rand()');
            expect(defaultVal).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(defaultVal)).toBe(true);

            expect(() => el.evaluate('rand(10)')).toThrow('expects exactly 2 parameters');
        });

        test('random', () => {
            const val = el.evaluate('random()');
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThan(1);
        });
    });

    describe('compile', () => {
        test('compiles to valid, runnable JavaScript using CompileRuntime', () => {
            const expressions = [
                ['abs(x)', { x: -7 }, 7],
                ['round(x, 2)', { x: 1.005 }, 1.01],
                ['round(x)', { x: -3.5 }, -4],
                ['floor(x)', { x: 8.9 }, 8],
                ['ceil(x)', { x: 8.1 }, 9],
                ['pow(x, 3)', { x: 3 }, 27],
                ['sqrt(x)', { x: 49 }, 7],
                ['clamp(x, 10, 20)', { x: 25 }, 20],
            ];

            for (const [expr, values, expected] of expressions) {
                const names = Object.keys(values);
                const source = el.compile(expr, names);
                const fn = new Function('__runtime', ...names, `return ${source};`);
                expect(fn(CompileRuntime, ...Object.values(values))).toBe(expected);
            }

            const badRandSource = el.compile('rand(10)');
            const badRandFn = new Function('__runtime', `return ${badRandSource};`);
            expect(() => badRandFn(CompileRuntime)).toThrow('expects exactly 2 parameters');
        });
    });

    describe('PHP compilation via dumpCompiled', () => {
        test('dumps valid PHP syntax for math functions', () => {
            const compiled = new CompiledExpressionLanguage(el);
            const php = compiled.dumpCompiled([
                'abs(a)',
                'round(a, 2)',
                'floor(a)',
                'ceil(a)',
                'pow(a, b)',
                'sqrt(a)',
                'clamp(a, 0, 10)',
                'rand(1, 6)',
                'random()',
            ], { target: 'php' });

            expect(php).toContain('\\abs($a)');
            expect(php).toContain('\\round($a, 2)');
            expect(php).toContain('\\floor($a)');
            expect(php).toContain('\\ceil($a)');
            expect(php).toContain('\\pow($a, $b)');
            expect(php).toContain('\\sqrt($a)');
            expect(php).toContain('\\min(10, \\max(0, $a))');
            expect(php).toContain('\\rand(1, 6)');
            expect(php).toContain('\\lcg_value()');
        });
    });
});
