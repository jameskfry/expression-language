import {
    CompiledExpressionLanguage,
    ExpressionLanguage,
    ExpressionFunction,
    StringProvider,
    ArrayProvider,
    DateProvider,
    BasicProvider,
    CASE_INSENSITIVE_STRING_OPERATORS,
    IGNORE_UNKNOWN_VARIABLES,
    LogicException,
    SyntaxError,
} from "../index";
import corpus from "./fixtures/symfony-corpus.json";

// An ExpressionLanguage whose parsing is observable: compiled expressions must never reach it
function createLanguages(providers = [], options = {}) {
    const language = new ExpressionLanguage(null, providers, options);
    const calls = {evaluate: 0, parse: 0};
    const evaluate = language.evaluate;
    const parse = language.parse;
    language.evaluate = (...args) => { calls.evaluate++; return evaluate(...args); };
    language.parse = (...args) => { calls.parse++; return parse(...args); };

    return {language, calls};
}

// the dump, loaded back the way an application would do it
function compile(expressions, providers = [], options = {}, extraRegistrations = () => {}) {
    const {language, calls} = createLanguages(providers, options);
    extraRegistrations(language);
    const dumper = new CompiledExpressionLanguage(language);
    const source = dumper.dumpCompiled(expressions);

    return {compiled: new CompiledExpressionLanguage(language, CompiledExpressionLanguage.load(dumpAsExpression(dumper, expressions))), source, calls, language};
}

function dumpAsExpression(dumper, expressions) {
    return dumper.dumpCompiled(expressions, {format: 'expression'});
}

describe('JavaScript target', () => {
    test('is the default, packaged as an ES module', () => {
        const dumper = new CompiledExpressionLanguage(new ExpressionLanguage());
        const source = dumper.dumpCompiled(['a + b']);

        expect(source).toMatch(/^\/\/ This file has been auto-generated/);
        expect(source).toContain('export default {');
        expect(source).toBe(dumper.dumpCompiled(['a + b'], {target: 'js', format: 'esm'}));
        expect(source).toContain('return (__runtime.symfony.add($a, $b)) ?? null;');
    });

    test('can be packaged as a CommonJS module or as a bare expression', () => {
        const language = new ExpressionLanguage();
        const dumper = new CompiledExpressionLanguage(language);

        const module = {exports: {}};
        new Function('module', dumper.dumpCompiled(['a + b'], {format: 'cjs'}))(module);
        expect(new CompiledExpressionLanguage(language, module.exports).evaluate('a + b', {a: 1, b: 2})).toBe(3);

        const expression = dumper.dumpCompiled(['a + b'], {format: 'expression'});
        expect(expression.startsWith('({')).toBe(true);
        // the source can be handed to the constructor directly
        expect(new CompiledExpressionLanguage(language, expression).evaluate('a + b', {a: 1, b: 2})).toBe(3);
    });

    test('an ES module dump is valid module syntax', () => {
        const source = new CompiledExpressionLanguage(new ExpressionLanguage()).dumpCompiled(['a + b', 'x ?? 1']);
        const loaded = new Function(source.replace('export default', 'return'))();

        expect(loaded.format).toBe(1);
        expect(loaded.expressions.map(([expression]) => expression)).toEqual(['a + b', 'x ?? 1']);
    });

    test('evaluates compiled expressions without parsing them', () => {
        const {compiled, calls} = compile(['a * b > 10', 'name ?? "anonymous"']);

        expect(compiled.evaluate('a * b > 10', {a: 3, b: 4})).toBe(true);
        expect(compiled.evaluate('a * b > 10', {a: 1, b: 4})).toBe(false);
        expect(compiled.evaluate('name ?? "anonymous"', {})).toBe('anonymous');
        expect(compiled.evaluate('name ?? "anonymous"', {name: 'Ann'})).toBe('Ann');
        expect(calls).toEqual({evaluate: 0, parse: 0});
    });

    test('hands what it did not compile to the decorated language', () => {
        const {compiled, calls} = compile(['a + b']);

        expect(compiled.evaluate('a - b', {a: 5, b: 3})).toBe(2);
        expect(calls.evaluate).toBe(1);
    });

    test('an expression given as an object is looked up by its text', () => {
        const {compiled, calls} = compile(['a + b']);

        expect(compiled.evaluate({toString: () => 'a + b'}, {a: 1, b: 2})).toBe(3);
        expect(calls.evaluate).toBe(0);
    });

    test('a ParsedExpression is evaluated as it was parsed, with its own rules, not through the compiled code', () => {
        const {compiled, calls, language} = compile(['a + b']);
        const parsedAsJs = new ExpressionLanguage(null, [], {semantics: 'js'}).parse('a + b', ['a', 'b']);

        expect(compiled.evaluate('a + b', {a: '5', b: 1})).toBe(6);
        expect(calls.evaluate).toBe(0);
        // the nodes of the ParsedExpression follow JavaScript's rules: that is what is evaluated
        expect(compiled.evaluate(parsedAsJs, {a: '5', b: 1})).toBe('51');
        expect(compiled.evaluate(language.parse('a + b', ['a', 'b']), {a: '5', b: 1})).toBe(6);
        expect(calls.evaluate).toBe(2);
    });

    test('a variable the values do not hold is missing, whatever Object.prototype holds', () => {
        const {compiled, calls} = compile(['toString ?? "default"', 'constructor ?? 1', '__proto__ ?? 2', 'valueOf ?? 3', 'hasOwnProperty ?? 4']);

        expect(compiled.evaluate('toString ?? "default"', {})).toBe('default');
        expect(compiled.evaluate('constructor ?? 1', {})).toBe(1);
        expect(compiled.evaluate('__proto__ ?? 2', {})).toBe(2);
        expect(compiled.evaluate('valueOf ?? 3', {})).toBe(3);
        expect(compiled.evaluate('hasOwnProperty ?? 4', {})).toBe(4);
        // ...and one it does hold is read
        expect(compiled.evaluate('toString ?? "default"', {toString: 'mine'})).toBe('mine');
        expect(calls.evaluate).toBe(0);
    });

    test('leaves out what cannot be compiled, and does not choke on duplicates', () => {
        const dumper = new CompiledExpressionLanguage(new ExpressionLanguage());
        const source = dumper.dumpCompiled(['a + b', '1 +', 'unknownFunction(1)', 'a + b', '"abc" matches "/("'], {format: 'expression'});
        const loaded = CompiledExpressionLanguage.load(source);

        expect(loaded.expressions.map(([expression]) => expression)).toEqual(['a + b']);
    });

    test('an empty list gives an empty, loadable dump', () => {
        const language = new ExpressionLanguage();
        const dumper = new CompiledExpressionLanguage(language);

        for (const format of ['esm', 'cjs', 'expression']) {
            expect(dumper.dumpCompiled([], {format})).toContain('expressions: []');
        }
        expect(new CompiledExpressionLanguage(language, dumper.dumpCompiled([], {format: 'expression'})).evaluate('1 + 1')).toBe(2);
    });

    test('variables whose names are keywords, globals or helpers of the generated code', () => {
        const names = ['class', 'this', 'values', 'functions', '__runtime', 'String', 'Math', 'undefined', 'constructor', '__proto__', 'new', 'return', 'NaN', 'Object'];
        const values = Object.fromEntries(names.map((name, index) => [name, index + 1]));
        // JSON.parse so that "__proto__" is an own property, as it would be for data read from JSON
        const data = JSON.parse(JSON.stringify(values));
        const expression = names.join(' + ');
        const {compiled, calls} = compile([expression, '__proto__', 'constructor ~ "x"', 'String ~ Math']);

        expect(compiled.evaluate(expression, data)).toBe(names.length * (names.length + 1) / 2);
        expect(compiled.evaluate('__proto__', data)).toBe(names.indexOf('__proto__') + 1);
        expect(compiled.evaluate('constructor ~ "x"', data)).toBe(names.indexOf('constructor') + 1 + 'x');
        expect(compiled.evaluate('String ~ Math', data)).toBe('' + (names.indexOf('String') + 1) + (names.indexOf('Math') + 1));
        expect(calls.evaluate).toBe(0);
    });

    test('an expression named like a property of Object is found', () => {
        const {compiled, calls} = compile(['toString', '__proto__', 'constructor']);

        expect(compiled.evaluate('toString', {toString: 'a'})).toBe('a');
        expect(calls.evaluate).toBe(0);
        // not compiled: handed over to the decorated language, which does not know the variable
        expect(() => compiled.evaluate('valueOf', {})).toThrow('Variable "valueOf" is not valid');
    });

    describe('variables', () => {
        test('a missing variable is reported the way the decorated language reports it', () => {
            const {compiled, calls} = compile(['price * quantity']);

            expect(() => compiled.evaluate('price * quantity', {price: 2})).toThrow(SyntaxError);
            expect(() => compiled.evaluate('price * quantity', {price: 2})).toThrow('Variable "quantity" is not valid around position 9 for expression `price * quantity`.');
            expect(calls.evaluate).toBe(2);
        });

        test('a variable only guarded by ?? may be missing', () => {
            const {compiled, calls} = compile(['a + (b ?? 10)', 'b ?? a']);

            expect(compiled.evaluate('a + (b ?? 10)', {a: 1})).toBe(11);
            expect(compiled.evaluate('a + (b ?? 10)', {a: 1, b: 2})).toBe(3);
            expect(compiled.evaluate('b ?? a', {a: 5})).toBe(5);
            expect(calls.evaluate).toBe(0);
            // ...but the other one may not
            expect(() => compiled.evaluate('a + (b ?? 10)', {b: 1})).toThrow('Variable "a" is not valid');
        });

        test('a variable that is present but undefined or null is fine', () => {
            const {compiled, calls} = compile(['a ?? "d"', 'a']);

            expect(compiled.evaluate('a ?? "d"', {a: null})).toBe('d');
            expect(compiled.evaluate('a ?? "d"', {a: undefined})).toBe('d');
            expect(compiled.evaluate('a', {a: null})).toBeNull();
            expect(calls.evaluate).toBe(0);
        });

        test('a null result is null, never undefined', () => {
            const {compiled} = compile(['a?.b', 'a?.[0]', 'o.missing']);

            expect(compiled.evaluate('a?.b', {a: null})).toBeNull();
            expect(compiled.evaluate('a?.[0]', {a: null})).toBeNull();
            expect(compiled.evaluate('o.missing', {o: {}})).toBeNull();
        });
    });

    describe('functions', () => {
        test('built-in and provider functions work, including those relying on the runtime', () => {
            const providers = [new StringProvider(), new ArrayProvider(), new DateProvider()];
            const {compiled, calls} = compile(['min(a, b)', 'max([1, 5, 3])', 'count(list)', 'strtoupper(name) ~ "!"', 'implode(",", list)', 'strlen("héllo")'], providers);

            expect(compiled.evaluate('min(a, b)', {a: 4, b: 2})).toBe(2);
            expect(compiled.evaluate('max([1, 5, 3])')).toBe(5);
            expect(compiled.evaluate('count(list)', {list: [1, 2, 3]})).toBe(3);
            expect(compiled.evaluate('strtoupper(name) ~ "!"', {name: 'ann'})).toBe('ANN!');
            expect(compiled.evaluate('implode(",", list)', {list: [1, 2]})).toBe('1,2');
            expect(compiled.evaluate('strlen("héllo")')).toBe(5);
            expect(calls.evaluate).toBe(0);
        });

        test('a function whose compiler throws is called through its evaluator, with the values', () => {
            const evaluator = jest.fn((values, a, b) => a + b + values.offset);
            const {compiled, source, calls} = compile(['plus(x, 2) * 2'], [], {}, (language) => {
                language.register('plus', () => { throw new Error('cannot be compiled'); }, evaluator);
            });

            expect(source).toContain('functions["plus"].evaluator(values, $x, 2)');
            expect(compiled.evaluate('plus(x, 2) * 2', {x: 1, offset: 10})).toBe(26);
            expect(evaluator).toHaveBeenCalledTimes(1);
            expect(evaluator.mock.calls[0][0]).toEqual({x: 1, offset: 10});
            expect(calls.evaluate).toBe(0);
        });

        test('a function registered after the dump is still found', () => {
            const {compiled, language} = compile(['a + 1']);
            compiled.register('late', () => '1', () => 1);
            // the decorated language was never used to parse, so registering is still allowed
            expect(language.functions.late).toBeDefined();
        });

        test('the functions of the decorated language are what the dump is compiled against', () => {
            const dumper = new CompiledExpressionLanguage(new ExpressionLanguage());
            const loaded = CompiledExpressionLanguage.load(dumper.dumpCompiled(['myFn(1)'], {format: 'expression'}));

            // myFn does not exist for the dump: the expression is left out
            expect(loaded.expressions).toEqual([]);
            dumper.register('myFn', (x) => `(${x} + 1)`, (values, x) => x + 1);
            expect(CompiledExpressionLanguage.load(dumper.dumpCompiled(['myFn(1)'], {format: 'expression'})).expressions).toHaveLength(1);
        });

        test('errors of the code are not caught, and the code is not run twice', () => {
            const lock = jest.fn(() => { throw new RangeError('Already locked.'); });
            const {compiled, calls} = compile(['foo.lock()']);

            expect(() => compiled.evaluate('foo.lock()', {foo: {lock}})).toThrow('Already locked.');
            expect(lock).toHaveBeenCalledTimes(1);
            expect(calls.evaluate).toBe(0);
        });

        test('a method keeps its `this`', () => {
            const {compiled} = compile(['counter.next(1)']);
            const counter = {count: 41, next(by) { return this.count + by; }};

            expect(compiled.evaluate('counter.next(1)', {counter})).toBe(42);
        });
    });

    describe('options', () => {
        test('a dump made while ignoring case is only accepted by a language that ignores case', () => {
            const options = {caseInsensitiveStringOperators: true};
            const dumper = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], options));
            const source = dumper.dumpCompiled(['name contains "BOB"'], {format: 'expression'});

            const loaded = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], options), source);
            expect(loaded.evaluate('name contains "BOB"', {name: 'bobby'})).toBe(true);

            expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(), source)).toThrow(LogicException);
            expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(), source)).toThrow('were generated with the parser flags 4, but this language uses 0');
        });

        test('case-sensitive by default', () => {
            const {compiled} = compile(['name contains "BOB"']);

            expect(compiled.evaluate('name contains "BOB"', {name: 'bobby'})).toBe(false);
        });

        test('unknown targets and formats are refused', () => {
            const dumper = new CompiledExpressionLanguage(new ExpressionLanguage());

            expect(() => dumper.dumpCompiled(['1'], {target: 'rust'})).toThrow('Unknown target "rust": use "js" or "php".');
            expect(() => dumper.dumpCompiled(['1'], {format: 'amd'})).toThrow('Unknown format "amd"');
            // the format is meaningless for PHP
            expect(() => dumper.dumpCompiled(['1'], {target: 'php', format: 'amd'})).not.toThrow();
        });

        test('what is loaded has to be a dump', () => {
            const language = new ExpressionLanguage();

            for (const bogus of [{}, [], {format: 2, flags: 0, expressions: []}, {format: 1, flags: 0}, 'x']) {
                expect(() => new CompiledExpressionLanguage(language, bogus)).toThrow();
            }
            expect(() => new CompiledExpressionLanguage(language, {})).toThrow(LogicException);
        });
    });

    describe('semantics', () => {
        const SEMANTICS = ['symfony', 'js', 'portable'];

        test.each(SEMANTICS)('a dump made with the %s semantics runs with them', (semantics) => {
            const expressions = ['a + b', 'a == b', 'a ? "yes" : "no"', 'a && b', 'not a'];
            const dumper = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics}));
            const plain = new ExpressionLanguage(null, [], {semantics});
            const fast = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics}), dumper.dumpCompiled(expressions, {format: 'expression'}));

            for (const [a, b] of [[1, 2], ['5', 1], ['0', ''], [null, false], [[], 0], ['abc', 'abc']]) {
                for (const expression of expressions) {
                    const run = (language) => {
                        try {
                            return {value: language.evaluate(expression, {a, b})};
                        } catch (e) {
                            return {error: e.name};
                        }
                    };

                    expect([semantics, expression, a, b, run(fast)]).toEqual([semantics, expression, a, b, run(plain)]);
                }
            }
        });

        test('the compiled code of the default semantics gets the runtime from the loader', () => {
            const {compiled, source, calls} = compile(['"5" + 1', 'a == "abc"']);

            expect(source).toContain('__runtime.symfony.add("5", 1)');
            expect(compiled.evaluate('"5" + 1')).toBe(6);
            expect(compiled.evaluate('a == "abc"', {a: 0})).toBe(false);
            expect(calls.evaluate).toBe(0);
        });

        test('a dump made with some semantics is refused by a language that has others', () => {
            const source = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics: 'js'})).dumpCompiled(['a + b'], {format: 'expression'});

            expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(), source)).toThrow(LogicException);
            expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics: 'portable'}), source)).toThrow('were generated with the parser flags 8, but this language uses 16');
            expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics: 'js'}), source)).not.toThrow();
        });

        test('a PHP file cannot follow the "js" semantics', () => {
            const dumper = new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics: 'js'}));

            expect(() => dumper.dumpCompiled(['a + b'], {target: 'php'})).toThrow(LogicException);
            expect(() => dumper.dumpCompiled(['a + b'], {target: 'php'})).toThrow('always runs with PHP\'s rules');
            for (const semantics of ['symfony', 'portable']) {
                expect(() => new CompiledExpressionLanguage(new ExpressionLanguage(null, [], {semantics})).dumpCompiled(['a + b'], {target: 'php'})).not.toThrow();
            }
        });
    });

    describe('lint', () => {
        test('uses the variables recorded at dump time', () => {
            const {compiled, calls} = compile(['a + b + (c ?? 1)']);

            expect(() => compiled.lint('a + b + (c ?? 1)', ['a', 'b'])).not.toThrow();
            expect(() => compiled.lint('a + b + (c ?? 1)', ['a'])).toThrow('Variable "b" is not valid around position 5 for expression `a + b + (c ?? 1)`.');
            expect(() => compiled.lint('a + b + (c ?? 1)', [])).toThrow('Variable "a" is not valid');
            expect(() => compiled.lint('a + b + (c ?? 1)', [], IGNORE_UNKNOWN_VARIABLES)).not.toThrow();
            expect(calls).toEqual({evaluate: 0, parse: 0});
        });

        test('accepts a name given as {compiledName: expressionName}, like the decorated language', () => {
            const {compiled, language} = compile(['container.x', 'a + b']);

            expect(() => language.lint('container.x', [{this: 'container'}])).not.toThrow();
            expect(() => compiled.lint('container.x', [{this: 'container'}])).not.toThrow();
            expect(() => compiled.lint('container.x', [{this: 'container'}], 0)).not.toThrow();
            expect(() => compiled.lint('a + b', ['a', {x: 'b'}])).not.toThrow();
            expect(() => compiled.lint('a + b', [{x: 'b'}])).toThrow('Variable "a" is not valid');
        });

        test('with the same suggestions as the decorated language', () => {
            const {compiled} = compile(['name']);

            expect(() => compiled.lint('name', ['nam'])).toThrow('Did you mean "nam"?');
        });

        test('the variables of a dump made while ignoring case are the same', () => {
            const {compiled} = compile(['a contains b'], [], {caseInsensitiveStringOperators: true});

            expect(() => compiled.lint('a contains b', ['a', 'b'], CASE_INSENSITIVE_STRING_OPERATORS)).not.toThrow();
        });

        test('hands anything else to the decorated language', () => {
            const {compiled} = compile(['a']);

            expect(() => compiled.lint('a +', ['a'])).toThrow(SyntaxError);
            expect(() => compiled.lint('b', ['a'])).toThrow('Variable "b" is not valid');
            expect(() => compiled.lint('b', ['b'])).not.toThrow();
            expect(() => compiled.lint(compiled.parse('b', ['b']), [])).not.toThrow();
        });
    });

    describe('decorating', () => {
        test('compile(), parse() and the registrations are those of the decorated language', () => {
            const language = new ExpressionLanguage();
            const compiled = new CompiledExpressionLanguage(language);

            compiled.register('one', () => '1', () => 1);
            compiled.addFunction(new ExpressionFunction('two', () => '2', () => 2));
            compiled.registerProvider(new BasicProvider());

            expect(Object.keys(compiled.functions)).toEqual(expect.arrayContaining(['one', 'two', 'isset', 'min']));
            expect(compiled.functions).toBe(language.functions);
            expect(compiled.compile('one() + two()')).toBe(language.compile('one() + two()'));
            expect(compiled.parse('one()', []).getNodes().dump()).toBe('one()');
            expect(compiled.evaluate('one() + two()')).toBe(3);
        });

        test('registering after something was parsed is refused, like it is without the decorator', () => {
            const compiled = new CompiledExpressionLanguage(new ExpressionLanguage());
            compiled.evaluate('1 + 1');

            expect(() => compiled.register('late', () => '1', () => 1)).toThrow(LogicException);
        });

        test('dumping does not freeze the registration of functions', () => {
            const compiled = new CompiledExpressionLanguage(new ExpressionLanguage());
            compiled.dumpCompiled(['1 + 1']);

            expect(() => compiled.register('late', () => '1', () => 1)).not.toThrow();
        });
    });

    test('the dump, evaluated, gives what the decorated language gives for the whole Symfony corpus', () => {
        const language = new ExpressionLanguage();
        const dumper = new CompiledExpressionLanguage(language);
        const compiled = new CompiledExpressionLanguage(language, CompiledExpressionLanguage.load(dumper.dumpCompiled(corpus.map(([expression]) => expression), {format: 'expression'})));
        const run = (target, expression, variables) => {
            try {
                return {result: target.evaluate(expression, JSON.parse(JSON.stringify(variables)))};
            } catch (e) {
                return {error: e};
            }
        };
        const unexpected = [];
        let compiledCount = 0;

        for (const [expression, variables] of corpus) {
            if (compiled.compiledExpressions.has(expression)) {
                compiledCount++;
            }
            const expected = run(language, expression, variables);
            const actual = run(compiled, expression, variables);

            if ('error' in expected && 'error' in actual) {
                continue;
            }
            // compiled code is plain JavaScript: reading a property of a primitive gives nothing instead of raising,
            // and a property that does not exist is null instead of undefined
            if ('error' in expected && /^Unable to get (property|an item)/.test(expected.error.message)) {
                continue;
            }
            if ('result' in expected && expected.result === undefined && actual.result === null) {
                continue;
            }

            try {
                expect(actual).toEqual(expected);
            } catch (e) {
                unexpected.push({expression, variables, expected, actual});
            }
        }

        expect(compiledCount).toBeGreaterThan(300);
        expect(unexpected).toEqual([]);
    });
});

describe('PHP target', () => {
    const dump = (expressions, providers = [], options = {}, register = () => {}) => {
        const language = new ExpressionLanguage(null, providers, options);
        register(language);

        return new CompiledExpressionLanguage(language).dumpCompiled(expressions, {target: 'php'});
    };

    test('an empty list gives an empty file', () => {
        expect(dump([])).toBe("<?php\n\nreturn [];\n");
        expect(dump(['1 +'])).toBe("<?php\n\nreturn [];\n");
    });

    test('generates the file Symfony loads: one static method per expression and a map', () => {
        const php = dump(['price * quantity > 100', 'name ?? "anonymous"']);

        expect(php).toMatch(/^<\?php\n\n\/\/ This file has been auto-generated/);
        expect(php).toMatch(/\nnamespace ExpressionLanguage[0-9a-f]{16};\n/);
        expect(php).toContain("if (!\\class_exists(CompiledExpressions::class, false)) {\n    final class CompiledExpressions\n    {\n");
        expect(php).toContain("        public static function e0(array $values): mixed\n        {\n            $price = $values['price'] ?? null;\n            $quantity = $values['quantity'] ?? null;\n\n            return (($price * $quantity) > 100);\n        }\n");
        expect(php).toContain("        public static function e1(array $values): mixed\n        {\n            $name = $values['name'] ?? null;\n\n            return (($name) ?? (\"anonymous\"));\n        }\n");
        expect(php).toMatch(/\n    'price \* quantity > 100' => \['ExpressionLanguage[0-9a-f]{16}\\\\CompiledExpressions::e0', \['price' => 1, 'quantity' => 9\], false\],\n/);
        expect(php).toMatch(/\n    'name \?\? "anonymous"' => \['ExpressionLanguage[0-9a-f]{16}\\\\CompiledExpressions::e1', \['name' => NULL\], false\],\n/);
    });

    test('the namespace follows the content, so that two dumps can live in one process', () => {
        const namespace = (php) => php.match(/namespace (ExpressionLanguage[0-9a-f]+);/)[1];

        expect(namespace(dump(['a + b']))).toBe(namespace(dump(['a + b'])));
        expect(namespace(dump(['a + b']))).not.toBe(namespace(dump(['a - b'])));
    });

    test.each([
        ['1 + 2 * 3', '(1 + (2 * 3))'],
        ['"a" ~ "b"', '("a" . "b")'],
        ['not a', '(!$a)'],
        ['a and b or c', '(($a && $b) || $c)'],
        ['a xor b', '($a xor $b)'],
        ['a ? b : c', '(($a) ? ($b) : ($c))'],
        ['a ?: c', '(($a) ? ($a) : ($c))'],
        ['a ? b', '(($a) ? ($b) : (NULL))'.replace('NULL', 'null')],
        ['a ?? "d"', '(($a) ?? ("d"))'],
        // dumps are parsed without knowing the variables, like Symfony's: there is no NullCoalescedNameNode
        ['unknown ?? "d"', '(($unknown) ?? ("d"))'],
        ['2 ** 3', 'pow(2, 3)'],
        ['1..3', 'range(1, 3)'],
        ['a in [1, 2]', '\\in_array($a, [0 => 1, 1 => 2], true)'],
        ['a not in [1]', '!\\in_array($a, [0 => 1], true)'],
        ['a contains "x"', 'str_contains($a, "x")'],
        ['a starts with "x"', 'str_starts_with($a, "x")'],
        ['a ends with "x"', 'str_ends_with($a, "x")'],
        ['{a: 1, "b": [2], (1 + 1): 3}', '["a" => 1, "b" => [0 => 2], (1 + 1) => 3]'],
        ['a.b', '$a->b'],
        ['a?.b', '$a?->b'],
        ['a.m(1, b)', '$a->m(1, $b)'],
        ['a?.m()', '$a?->m()'],
        ['a[0]', '$a[0]'],
        ['a?.[0]', '\\Symfony\\Component\\ExpressionLanguage\\Node\\GetAttrNode::convertToArrayAccess($a, "a")?->offsetGet(0)'],
        ['a.b?.[0]', '\\Symfony\\Component\\ExpressionLanguage\\Node\\GetAttrNode::convertToArrayAccess($a->b, "a.b")?->offsetGet(0)'],
        ['min(a, 2)', '\\min($a, 2)'],
        ['max([1, 2])', '\\max([0 => 1, 1 => 2])'],
        ['count(a)', '\\count($a)'],
        ['"tab\\there $x \\\\ \\""', '"tab\\there \\$x \\\\ \\""'],
        ['1.5', '1.5'],
        ['7', '7'],
        ['1.0', '1.0'],
        ['1e3', '1000.0'],
        ['.5', '0.5'],
        ['-a', '(-$a)'],
        ['~a', '(~$a)'],
        ['true', 'true'],
        ['NULL', 'null'],
    ])('%s compiles to %s', (expression, expected) => {
        const php = dump([expression]);
        const body = php.match(/return (.*);\n        \}/s)[1];

        expect(body).toBe(expected);
    });

    test('the string operators ignore case with mb_strtolower() when asked to', () => {
        const php = dump(['a contains "X"', 'a starts with b'], [], {caseInsensitiveStringOperators: true});

        expect(php).toContain('return str_contains(\\mb_strtolower($a), \\mb_strtolower("X"));');
        expect(php).toContain('return str_starts_with(\\mb_strtolower($a), \\mb_strtolower($b));');
    });

    test('matches validates a constant pattern and compiles to the closure Symfony generates', () => {
        const php = dump(['a matches "/^x/i"', 'a matches "/(/"', 'a matches p', 'a matches "/" ~ p ~ "/"']);

        expect(php).toContain('preg_match($regexp, (string) $str); } finally { restore_error_handler(); } })("/^x/i", $a);');
        expect(php).toContain('})($p, $a);');
        expect(php).toContain('})(("/" . ($p . "/")), $a)'.replace('("/" . ($p . "/"))', '(("/" . $p) . "/")'));
        // an invalid constant pattern is a syntax error: that expression is left out
        expect(php).not.toContain('"/(/"');
        expect(php).not.toContain("'a matches \"/(/\"'");
    });

    test('a function declared as a plain PHP function is called directly', () => {
        const php = dump(['strtoupper(name) ~ substr(name, 1, 2)', 'date("Y", t)'], [new StringProvider(), new DateProvider()]);

        expect(php).toContain('return (\\strtoupper($name) . \\substr($name, 1, 2));');
        expect(php).toContain('return \\date("Y", $t);');
        expect(php).toContain("e0(array $values): mixed");
    });

    test('ExpressionFunction#withPhpFunction() declares the PHP function, and a PHP compiler can be given', () => {
        const php = dump(['fn1(a)', 'fn2(a, 2)', 'fn3(a)'], [], {}, (language) => {
            language.addFunction(new ExpressionFunction('fn1', (x) => x, (v, x) => x).withPhpFunction('app_fn'));
            language.addFunction(new ExpressionFunction('fn2', (x, y) => x, (v, x) => x, (x, y) => `\\App\\twice(${x}, ${y})`));
            language.register('fn3', (x) => x, (v, x) => x, () => { throw new Error('no php'); });
        });

        expect(php).toContain('return \\app_fn($a);');
        expect(php).toContain('return \\App\\twice($a, 2);');
        // the PHP compiler throws: called through the evaluator
        expect(php).toContain("e2(array $values, array $functions): mixed");
        expect(php).toContain("return $functions['fn3']['evaluator']($values, $a);");
    });

    test('a function without a PHP compiler is called through the evaluator, which is flagged in the map', () => {
        const php = dump(['isset(a.b) ? twice(a) : 0'], [new BasicProvider()], {}, (language) => language.register('twice', (x) => x, (v, x) => x));

        expect(php).toContain("public static function e0(array $values, array $functions): mixed");
        expect(php).toContain("$functions['isset']['evaluator']($values, $a->b)");
        expect(php).toContain("$functions['twice']['evaluator']($values, $a)");
        expect(php).toMatch(/=> \['ExpressionLanguage[0-9a-f]{16}\\\\CompiledExpressions::e0', \['a' => \d+\], true\],/);
    });

    test('a function that does not exist leaves the expression out', () => {
        expect(dump(['nope(1)'])).toBe("<?php\n\nreturn [];\n");
    });

    test('variables that PHP cannot assign get another name, and the parameters never clash with a variable', () => {
        const php = dump(['this.count + _GET + GLOBALS', 'values ~ functions ~ unknown(1)', 'this ~ this_'], [], {}, (language) => language.register('unknown', (x) => x, (v, x) => x));

        expect(php).toContain("$this_ = $values['this'] ?? null;\n");
        expect(php).toContain("$_GET_ = $values['_GET'] ?? null;");
        expect(php).toContain("$GLOBALS_ = $values['GLOBALS'] ?? null;");
        expect(php).toContain('return (($this_->count + $_GET_) + $GLOBALS_);');

        // `values` and `functions` are variables of the expression, so the parameters are renamed
        expect(php).toContain("e1(array $values_, array $functions_): mixed");
        expect(php).toContain("$values = $values_['values'] ?? null;");
        expect(php).toContain("$functions_['unknown']['evaluator']($values_, 1)");

        // both `this` and `this_` are variables: the replacement of `this` must not collide with the other
        expect(php).toContain("$this__ = $values['this'] ?? null;");
        expect(php).toContain("$this_ = $values['this_'] ?? null;");
        expect(php).toContain('return ($this__ . $this_);');
    });

    test('strings and keys are exported as PHP source, whatever they contain', () => {
        const php = dump(["a ~ '$x \\\\ \\' \"'", '"line1\\nline2" ~ a']);

        expect(php).toContain("    'a ~ \\'$x \\\\\\\\ \\\\\\' \"\\'' => [");
        expect(php).toContain('return ($a . "$x \\\\ \' \\"");'.replace('"$x', '"\\$x'));
        expect(php).toContain('"line1\nline2"');
    });

    test('numeric-string expressions and variables are valid keys', () => {
        const php = dump(['1', '0', '-1', 'a']);

        expect(php).toContain("    '1' => [");
        expect(php).toContain("    '-1' => [");
    });
});

// The generated PHP has to be accepted by Symfony's own loader. That needs PHP, a checkout of the component and the tokenizer: opt in with
//
//   SYMFONY_EXPRESSION_LANGUAGE_PATH=/path/to/checkout npm test -- CompiledExpressionLanguage
//
// (see scripts/verify-compiled-php.php; PHP_BIN picks another php binary).
const symfonyPath = process.env.SYMFONY_EXPRESSION_LANGUAGE_PATH;
const phpBinary = process.env.PHP_BIN || 'php';
const phpTest = symfonyPath ? test : test.skip;

phpTest('Symfony\'s own CompiledExpressionLanguage runs the PHP dump like the file it dumps itself', () => {
    const {spawnSync} = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sel-compiled-'));
    try {
        const dumped = path.join(directory, 'compiled.php');
        fs.writeFileSync(dumped, new CompiledExpressionLanguage(new ExpressionLanguage()).dumpCompiled(corpus.map(([expression]) => expression), {target: 'php'}));

        const result = spawnSync(phpBinary, ['-d', 'xdebug.mode=off', '-d', 'xdebug.max_nesting_level=-1', path.join(__dirname, '../../scripts/verify-compiled-php.php'), symfonyPath, dumped, path.join(__dirname, 'fixtures/symfony-corpus.json')], {encoding: 'utf8'});
        const report = JSON.parse(result.stdout);

        expect(report.mismatches).toEqual([]);
        expect(report.compiled).toBeGreaterThan(300);
        expect(report.identical).toBe(report.checked);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});
