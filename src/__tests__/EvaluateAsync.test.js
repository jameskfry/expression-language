import ExpressionLanguage from "../ExpressionLanguage";
import CompiledExpressionLanguage from "../CompiledExpressionLanguage";

describe('evaluateAsync', () => {
    let el;

    beforeEach(() => {
        el = new ExpressionLanguage();
    });

    test('evaluates simple expressions asynchronously', async () => {
        const result = await el.evaluateAsync('1 + 2 * 3');
        expect(result).toBe(7);
    });

    test('resolves Promise values passed in values object', async () => {
        const values = {
            user: Promise.resolve({ name: 'Alice', age: 30 }),
            role: Promise.resolve('admin'),
        };

        const result = await el.evaluateAsync('user.name ~ " (" ~ role ~ ")"', values);
        expect(result).toBe('Alice (admin)');
    });

    test('resolves async custom functions', async () => {
        el.register(
            'fetchPrice',
            (id) => `fetchPrice(${id})`,
            async (values, id) => {
                await new Promise((r) => setTimeout(r, 5));
                return id === 101 ? 19.99 : 0;
            }
        );

        const total = await el.evaluateAsync('fetchPrice(101) * qty', { qty: 3 });
        expect(total).toBeCloseTo(59.97);
    });

    test('resolves async object methods', async () => {
        const user = {
            hasPermission: async (perm) => {
                await new Promise((r) => setTimeout(r, 5));
                return perm === 'admin';
            },
        };

        const allowed = await el.evaluateAsync('user.hasPermission("admin") and balance > 0', {
            user,
            balance: 50,
        });
        expect(allowed).toBe(true);

        const denied = await el.evaluateAsync('user.hasPermission("superadmin") and balance > 0', {
            user,
            balance: 50,
        });
        expect(denied).toBe(false);
    });

    test('short-circuits && and and without calling right-hand async expression', async () => {
        let called = false;
        const helper = {
            shouldNotRun: async () => {
                called = true;
                return true;
            },
        };

        const result = await el.evaluateAsync('false && helper.shouldNotRun()', { helper });
        expect(result).toBe(false);
        expect(called).toBe(false);
    });

    test('short-circuits || and or without calling right-hand async expression', async () => {
        let called = false;
        const helper = {
            shouldNotRun: async () => {
                called = true;
                return true;
            },
        };

        const result = await el.evaluateAsync('true || helper.shouldNotRun()', { helper });
        expect(result).toBe(true);
        expect(called).toBe(false);
    });

    test('handles conditional ternary with async branches', async () => {
        let trueBranchCalled = false;
        let falseBranchCalled = false;

        const helper = {
            asyncTrue: async () => {
                trueBranchCalled = true;
                return 'yes';
            },
            asyncFalse: async () => {
                falseBranchCalled = true;
                return 'no';
            },
        };

        const result1 = await el.evaluateAsync('isMember ? helper.asyncTrue() : helper.asyncFalse()', {
            isMember: true,
            helper,
        });
        expect(result1).toBe('yes');
        expect(trueBranchCalled).toBe(true);
        expect(falseBranchCalled).toBe(false);

        trueBranchCalled = false;
        falseBranchCalled = false;

        const result2 = await el.evaluateAsync('isMember ? helper.asyncTrue() : helper.asyncFalse()', {
            isMember: false,
            helper,
        });
        expect(result2).toBe('no');
        expect(trueBranchCalled).toBe(false);
        expect(falseBranchCalled).toBe(true);
    });

    test('handles null-coalescing with async left branch', async () => {
        const helper = {
            fetchNull: async () => null,
            fetchValue: async () => 'found',
        };

        const fallback = await el.evaluateAsync('helper.fetchNull() ?? "default"', { helper });
        expect(fallback).toBe('default');

        const value = await el.evaluateAsync('helper.fetchValue() ?? "default"', { helper });
        expect(value).toBe('found');
    });

    test('evaluates async array and object literals', async () => {
        el.register('asyncVal', (x) => `asyncVal(${x})`, async (values, x) => x * 10);

        const arr = await el.evaluateAsync('[asyncVal(1), asyncVal(2), 3]');
        expect(arr).toEqual([10, 20, 3]);

        const obj = await el.evaluateAsync('{ a: asyncVal(1), b: "hello" }');
        expect(obj).toEqual({ a: 10, b: 'hello' });
    });

    test('works with unary operators and async values', async () => {
        const user = {
            isBanned: async () => false,
        };

        const canPost = await el.evaluateAsync('!user.isBanned()', { user });
        expect(canPost).toBe(true);
    });

    describe('CompiledExpressionLanguage', () => {
        test('evaluates expressions asynchronously in compiled and fallback modes', async () => {
            const compiled = new CompiledExpressionLanguage(el);
            const dump = compiled.dumpCompiled(['x * 2', 'name ?? "guest"'], { format: 'expression' });
            const loader = new CompiledExpressionLanguage(el, dump);

            const r1 = await loader.evaluateAsync('x * 2', { x: 21 });
            expect(r1).toBe(42);

            // With async function in fallback mode
            el.register('asyncFetch', (x) => `asyncFetch(${x})`, async (v, x) => x + 100);
            const r2 = await loader.evaluateAsync('asyncFetch(5)');
            expect(r2).toBe(105);
        });
    });
});
