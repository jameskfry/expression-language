import ExpressionLanguage from "../ExpressionLanguage";
import CompiledExpressionLanguage from "../CompiledExpressionLanguage";
import ParsedExpression from "../ParsedExpression";
import Expression from "../Expression";

describe('Expression Introspection & AST Walker', () => {
    let el;

    beforeEach(() => {
        el = new ExpressionLanguage();
    });

    describe('getVariables', () => {
        test('extracts variable names in order of appearance', () => {
            expect(el.getVariables('a + b * c')).toEqual(['a', 'b', 'c']);
        });

        test('deduplicates repeatedly accessed variables preserving first appearance', () => {
            expect(el.getVariables('x * x + y / x - z')).toEqual(['x', 'y', 'z']);
        });

        test('handles object member and array bracket access', () => {
            expect(el.getVariables('user.profile.name == "John" and items[index] > 0')).toEqual([
                'user',
                'items',
                'index',
            ]);
        });

        test('extracts null-coalesced variables without throwing', () => {
            expect(el.getVariables('settings.theme ?? defaultTheme ?? "light"')).toEqual([
                'settings',
                'defaultTheme',
            ]);
        });

        test('returns an empty array for expressions without variables', () => {
            expect(el.getVariables('1 + 2 * 3 == 7')).toEqual([]);
            expect(el.getVariables('"hello" ~ " world"')).toEqual([]);
        });

        test('works with unregistered functions without throwing', () => {
            expect(el.getVariables('customFilter(user.age, minAge) and compute(x)')).toEqual([
                'user',
                'minAge',
                'x',
            ]);
        });

        test('accepts Expression and ParsedExpression instances', () => {
            const rawExpr = new Expression('foo + bar');
            expect(el.getVariables(rawExpr)).toEqual(['foo', 'bar']);

            const parsed = el.parse('foo + bar', ['foo', 'bar']);
            expect(el.getVariables(parsed)).toEqual(['foo', 'bar']);
            expect(parsed.getVariables()).toEqual(['foo', 'bar']);
        });
    });

    describe('getFunctions', () => {
        test('extracts function names in order of appearance', () => {
            expect(el.getFunctions('min(a, max(b, c)) + count(items)')).toEqual([
                'min',
                'max',
                'count',
            ]);
        });

        test('deduplicates functions called multiple times', () => {
            expect(el.getFunctions('max(a, b) + max(c, d)')).toEqual(['max']);
        });

        test('extracts unregistered functions', () => {
            expect(el.getFunctions('unknownFunc(x) && anotherFunc(y)')).toEqual([
                'unknownFunc',
                'anotherFunc',
            ]);
        });

        test('returns empty array when no functions are called', () => {
            expect(el.getFunctions('a + b > 10')).toEqual([]);
        });

        test('works on ParsedExpression instances directly', () => {
            const parsed = el.parse('min(1, 2) + count([3])', []);
            expect(parsed.getFunctions()).toEqual(['min', 'count']);
            expect(el.getFunctions(parsed)).toEqual(['min', 'count']);
        });
    });

    describe('walk', () => {
        test('traverses all nodes in depth-first order', () => {
            const parsed = el.parse('a + b * 2', ['a', 'b']);
            const visited = [];

            parsed.walk((node, parent, key) => {
                visited.push({
                    name: node.name,
                    parentName: parent ? parent.name : null,
                    key,
                });
            });

            expect(visited.length).toBeGreaterThan(0);
            expect(visited[0].name).toBe('BinaryNode');
            expect(visited[0].parentName).toBeNull();
            expect(visited[0].key).toBeNull();

            const nodeNames = visited.map((v) => v.name);
            expect(nodeNames).toContain('NameNode');
            expect(nodeNames).toContain('ConstantNode');
            expect(nodeNames).toContain('BinaryNode');
        });

        test('skips children when visitor returns false', () => {
            const parsed = el.parse('(a + b) * (c + d)', ['a', 'b', 'c', 'd']);
            const visited = [];

            parsed.walk((node) => {
                visited.push(node.name);
                // Skip traversing into the right operand of the top-level multiplication
                if (node.name === 'BinaryNode' && node.attributes.operator === '*') {
                    // let it traverse, but if left binary node, skip its children
                }
                if (node.name === 'BinaryNode' && node.attributes.operator === '+') {
                    return false; // skip children of '+' BinaryNodes
                }
            });

            // NameNodes ('a', 'b', 'c', 'd') should NOT be visited because their parent '+' returned false
            expect(visited).not.toContain('NameNode');
            expect(visited).toEqual(['BinaryNode', 'BinaryNode', 'BinaryNode']);
        });

        test('works on deserialized ParsedExpression.fromJSON', () => {
            const original = el.parse('user.age >= minAge', ['user', 'minAge']);
            const serialized = JSON.stringify(original);
            const deserialized = ParsedExpression.fromJSON(serialized);

            expect(deserialized.getVariables()).toEqual(['user', 'minAge']);

            let count = 0;
            deserialized.walk(() => {
                count++;
            });
            expect(count).toBeGreaterThan(0);
        });
    });

    describe('CompiledExpressionLanguage', () => {
        test('extracts variables and functions from compiled expressions', () => {
            const compiled = new CompiledExpressionLanguage(el);
            const dump = compiled.dumpCompiled(['price * qty', 'user.name ?? "guest"'], {
                format: 'expression',
            });
            const loader = new CompiledExpressionLanguage(el, dump);

            expect(loader.getVariables('price * qty')).toEqual(['price', 'qty']);
            expect(loader.getVariables('user.name ?? "guest"')).toEqual(['user']);

            // Falls back for uncompiled expressions
            expect(loader.getVariables('a + b + c')).toEqual(['a', 'b', 'c']);
            expect(loader.getFunctions('min(x, y)')).toEqual(['min']);
        });
    });
});
