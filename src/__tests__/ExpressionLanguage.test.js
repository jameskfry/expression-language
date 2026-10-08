import ExpressionLanguage from "../ExpressionLanguage";
import ExpressionFunction from "../ExpressionFunction";
import ELSyntaxError from "../SyntaxError";
import DivisionByZeroError from "../DivisionByZeroError";
import CompileRuntime from "../CompileRuntime";
import PortabilityError from "../Semantics/PortabilityError";
import ArrayAdapter from "../Cache/ArrayAdapter";
import ParsedExpression from "../ParsedExpression";
import LogicException from "../LogicException";
import {CASE_INSENSITIVE_STRING_OPERATORS, IGNORE_UNKNOWN_FUNCTIONS, IGNORE_UNKNOWN_VARIABLES, SEMANTICS_JS, SEMANTICS_PORTABLE} from "../Parser";

test('short circuit evaluate', () => {
    let obj = {
        foo: () => {
            throw new Error("This method should not be called due to short circuiting.");
        }
    };

    let shortCircuits = [
        ['false && object.foo()', {object: obj}, false],
        ['false and object.foo()', {object: obj}, false],
        ['true || object.foo()', {object: obj}, true],
        ['true or object.foo()', {object: obj}, true],
    ];

    for (let shortCircuit of shortCircuits) {
        //console.log("Testing: ", shortCircuit[0]);
        let exprLang = new ExpressionLanguage();
        expect(exprLang.evaluate(shortCircuit[0], shortCircuit[1])).toBe(shortCircuit[2]);
    }
});

test('short circuit compile', () => {
    let shortCircuits = [
        ['false && foo', [{foo: 'foo'}], false],
        ['false and foo', [{foo: 'foo'}], false],
        ['true || foo', [{foo: 'foo'}], true],
        ['true or foo', [{foo: 'foo'}], true],
    ];

    // the compiled code of the default semantics calls the runtime
    const __runtime = CompileRuntime;
    for (let shortCircuit of shortCircuits) {
        let exprLang = new ExpressionLanguage();
        let compiled = exprLang.compile(shortCircuit[0], shortCircuit[1]);
        expect(eval(compiled)).toBe(shortCircuit[2]);
    }
});

test('caching for overridden variable names', () => {
    let expressionLanguage = new ExpressionLanguage(null, [], {semantics: 'js'}),
        expression = 'a + b';

    expressionLanguage.evaluate(expression, {a: 1, b: 1});
    let result = expressionLanguage.compile(expression, ['a', {'B': 'b'}])
    expect(result).toBe("(a + B)");
});

test('bitwise ~', () => {
    const el = new ExpressionLanguage();
    const res = el.evaluate("~4");
    expect(res).toBe(-5);
});

describe('supports all literals', () => {

    const el = new ExpressionLanguage();

    test("strings", () => {
        const res = el.evaluate("'testing 1234'");
        expect(res).toBe("testing 1234");

        const res2 = el.evaluate('"testing 1234"');
        expect(res2).toBe("testing 1234");
    });

    test("numbers", () => {
        expect(el.evaluate('123')).toBe(123);
        expect(el.evaluate('0.787')).toBeCloseTo(0.787);
        expect(el.evaluate('.1234')).toBeCloseTo(0.1234);
        expect(el.evaluate('1_000_000')).toBe(1000000);
    });

    test("arrays", () => {
        const arr = el.evaluate('[1, 2, 3]');
        expect(Array.isArray(arr)).toBe(true);
        expect(arr).toEqual([1, 2, 3]);
        expect(el.evaluate('[1, 2, 3][1]')).toBe(2);
        // comments inside arrays should be ignored
        const arrWithComments = el.evaluate('[1 /* a */, 2, /* b */ 3]');
        expect(arrWithComments).toEqual([1, 2, 3]);
    });

    test('hashes', () => {
        const res = el.evaluate("({foo: 'bar'}).foo");
        expect(res).toBe('bar');
    });

    test("booleans", () => {
        expect(el.evaluate('true')).toBe(true);
        expect(el.evaluate('false')).toBe(false);
    });

    test('null', () => {
        expect(el.evaluate('null')).toBeNull();
    });

    test('exponential', () => {
        expect(el.evaluate('1e-2')).toBeCloseTo(0.01);
        expect(el.evaluate('-.7_189e+10')).toBeCloseTo(-7189000000);
    });

    test('comments', () => {
        expect(el.evaluate('/* ignored */ 1 + 2')).toBe(3);
    });
});

test('strict equality', () => {
    let expressionLanguage = new ExpressionLanguage(null, [], {semantics: 'js'}),
        expression = '123 === a';

    let result = expressionLanguage.compile(expression, ['a']);
    expect(result).toBe("(123 === a)");
    expect(new ExpressionLanguage().compile(expression, ['a'])).toBe("__runtime.symfony.identical(123, a)");
});

// New tests adapted from Symfony ExpressionLanguageTest (PHP)

test('cached parse returns same instance', () => {
    const el = new ExpressionLanguage();
    const first = el.parse('1 + 1', []);
    const second = el.parse('1 + 1', []);
    expect(second).toBe(first);
});

test('parse returns same object when already parsed', () => {
    const el = new ExpressionLanguage();
    const parsed = el.parse('1 + 1', []);
    const again = el.parse(parsed, []);
    expect(again).toBe(parsed);
});

test('caching with different names order yields same parsed object', () => {
    const el = new ExpressionLanguage();
    const expr = 'a + b';
    const first = el.parse(expr, ['a', {B: 'b'}]);
    const second = el.parse(expr, [{B: 'b'}, 'a']);
    expect(second).toBe(first);
});

test('register after parse', () => {
    let callbacks = getRegisterCallbacks();

    for (let callback of callbacks) {
        try {
            let expressionLanguage = new ExpressionLanguage();
            expressionLanguage.parse("1 + 1", []);
            callback[0](expressionLanguage);
            console.log("Shouldn't get to this point.");
            expect(true).toBe(false);
        } catch (err) {
            //console.log(err);
            expect(err.name).toBe('LogicException');
        }
    }
});

test('register after eval', () => {
    let callbacks = getRegisterCallbacks();

    for (let callback of callbacks) {
        try {
            let expressionLanguage = new ExpressionLanguage();
            expressionLanguage.evaluate("1 + 1");
            callback[0](expressionLanguage);
            console.log("Shouldn't get to this point.");
            expect(true).toBe(false);
        } catch (err) {
            //console.log(err);
            expect(err.name).toBe('LogicException');
        }
    }
});

test('register after compile', () => {
    let callbacks = getRegisterCallbacks();

    for (let callback of callbacks) {
        try {
            let expressionLanguage = new ExpressionLanguage();
            expressionLanguage.compile("1 + 1");
            callback[0](expressionLanguage);
            console.log("Shouldn't get to this point.");
            expect(true).toBe(false);
        } catch (err) {
            //console.log(err);
            expect(err.name).toBe('LogicException');
        }
    }
});

test('bad callable', () => {
    try {
        let expressionLanguage = new ExpressionLanguage();
        expressionLanguage.evaluate("foo.myfunction()", {foo: {}});
        console.log("Shouldn't get to this point.");
        expect(true).toBe(false);
    } catch (err) {
        //console.log(err);
        expect(err.toString()).toBe('Error: Unable to call method "myfunction" of object "Object".');
    }
});

function compiledResult(el, expr, names = [], values = []) {
    return new Function('__runtime', ...names, 'return ' + el.compile(expr, names) + ';')(CompileRuntime, ...values);
}

test('built-in min function', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('min(1,2,3)')).toBe(1);
    expect(compiledResult(el, 'min(1,2,3)')).toBe(1);
});

test('built-in max function', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('max(1,2,3)')).toBe(3);
    expect(compiledResult(el, 'max(1,2,3)')).toBe(3);
});

test('min() and max() accept a single array or hash like PHP, evaluated and compiled', () => {
    const el = new ExpressionLanguage();
    for (const [expr, expected] of [
        ['min([3, 1, 2])', 1],
        ['max([3, 1, 2])', 3],
        ['min({a: 5, b: 4})', 4],
        ['max({a: 5, b: 9})', 9],
        ['min("b", "a", "c")', 'a'],
        ['max(a)', 7],
    ]) {
        expect(el.evaluate(expr, {a: [7, 2]})).toBe(expected);
        expect(compiledResult(el, expr, ['a'], [[7, 2]])).toBe(expected);
    }
});

test('min() and max() reject what PHP rejects, with PHP\'s messages', () => {
    const el = new ExpressionLanguage();
    for (const name of ['min', 'max']) {
        for (const run of [(expr) => el.evaluate(expr), (expr) => compiledResult(el, expr)]) {
            expect(() => run(`${name}([])`)).toThrow(`${name}(): Argument #1 ($value) must contain at least one element`);
            expect(() => run(`${name}()`)).toThrow(`${name}() expects at least 1 argument, 0 given`);
            expect(() => run(`${name}(4)`)).toThrow(`${name}(): Argument #1 ($value) must be of type array, int given`);
            expect(() => run(`${name}("a")`)).toThrow(`${name}(): Argument #1 ($value) must be of type array, string given`);
        }
    }
});

test('built-in count function counts arrays and hashes, evaluated and compiled', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('count([1, 2, 3])')).toBe(3);
    expect(el.evaluate('count({a: 1, b: 2})')).toBe(2);
    expect(compiledResult(el, 'count(a)', ['a'], [[1, 2]])).toBe(2);
    expect(() => el.evaluate('count("abc")')).toThrow('count(): Argument #1 ($value) must be of type Countable|array, string given');
    expect(() => el.evaluate('count(null)')).toThrow('count(): Argument #1 ($value) must be of type Countable|array, null given');
    expect(() => compiledResult(el, 'count(1.5)')).toThrow('must be of type Countable|array, float given');
});

test('constant() and enum() are not built in anymore: they require a ConstantFunctionProvider', () => {
    const el = new ExpressionLanguage();
    expect(() => el.evaluate('constant("Math.PI")')).toThrow('The function "constant" does not exist');
    expect(() => el.evaluate('enum("Math.PI")')).toThrow('The function "enum" does not exist');
});

test('operator collisions evaluate and compile', () => {
    const el = new ExpressionLanguage();
    const expr = 'foo.not in [bar]';
    const compiled = el.compile(expr, ['foo', 'bar']);
    // compiled code should be self-contained (no undefined `includes` global) and evaluable
    expect(compiled).toContain('(foo.not, [bar])');

    const resultEvaluated = el.evaluate(expr, {foo: {not: 'test'}, bar: 'test'});
    expect(resultEvaluated).toBe(true);

    const fn = new Function('__runtime', 'foo', 'bar', 'return ' + compiled + ';');
    expect(fn(CompileRuntime, {not: 'test'}, 'test')).toBe(true);
});

test('parse() without a names argument defaults to [] instead of throwing a TypeError', () => {
    const el = new ExpressionLanguage();
    // Regression: parse(expr) used to crash with "Cannot read properties of
    // undefined (reading 'sort')" instead of surfacing a real SyntaxError,
    // because `names` had no default (unlike evaluate()/compile()).
    expect(() => el.parse('1 +')).toThrow(ELSyntaxError);
    expect(el.parse('1 + 1').getNodes().evaluate({}, {})).toBe(2);
});

test('parse throws on incomplete expression (node.)', () => {
    const el = new ExpressionLanguage();
    expect(() => el.parse('node.', ['node'])).toThrow();
});

test('comments ignored in evaluate and compile', () => {
    const el = new ExpressionLanguage(null, [], {semantics: 'js'});
    expect(el.evaluate('1 /* foo */ + 2')).toBe(3);
    expect(el.compile('1 /* foo */ + 2')).toBe('(1 + 2)');
});

test('providers evaluate and compile via constructor (array and generator)', () => {
    const makeProvider = () => ({
        getFunctions: () => ([
            new ExpressionFunction('identity', (x) => `${x}`, (values, x) => x),
            new ExpressionFunction('strtoupper', (x) => `${x}.toUpperCase()`, (values, x) => (x ?? '').toString().toUpperCase()),
            new ExpressionFunction('strtolower', (x) => `${x}.toLowerCase()`, (values, x) => (x ?? '').toString().toLowerCase()),
            new ExpressionFunction('fn_namespaced', () => 'true', () => true),
        ])
    });

    const provider = makeProvider();

    const cases = [
        [ [provider] ],
        [ (function* () { yield provider; })() ],
    ];

    for (const [providers] of cases) {
        const el = new ExpressionLanguage(null, providers);
        expect(el.evaluate('identity("foo")')).toBe('foo');
        expect(el.compile('identity("foo")')).toBe('"foo"');

        expect(el.evaluate('strtoupper("foo")')).toBe('FOO');
        expect(el.compile('strtoupper("foo")')).toBe('"foo".toUpperCase()');

        expect(el.evaluate('strtolower("FOO")')).toBe('foo');
        expect(el.compile('strtolower("FOO")')).toBe('"FOO".toLowerCase()');

        expect(el.evaluate('fn_namespaced()')).toBe(true);
        expect(el.compile('fn_namespaced()')).toBe('true');
    }
});

function getRegisterCallbacks() {
    let provider = {
        getFunctions: () => {
            return [
                new ExpressionFunction('fn', () => {
                }, () => {
                })
            ]
        }
    };
    return [
        [
            (expressionLanguage) => {
                expressionLanguage.register('fn', () => {
                }, () => {
                });
            }
        ],
        [
            (expressionLanguage) => {
                expressionLanguage.addFunction(new ExpressionFunction('fn', () => {
                }, () => {
                }));
            }
        ],
        [
            (expressionLanguage) => {
                expressionLanguage.registerProvider(provider);
            }
        ]
    ]
}

test('backslashes properly escaped and handled', () => {
    const el = new ExpressionLanguage();
    const res = el.evaluate('"a\\\\b" matches "/^a\\\\\\\\b$/"');
    expect(res).toBe(true);

    const res2 = el.evaluate('"\\\\"');
    expect(res2).toBe("\\");
});

test('ternary operator supported', () => {
    let el = new ExpressionLanguage();
    for (const [expr, variables, expectedResult, expectedExceptionMessage=null] of getTernary()) {
        if (expectedExceptionMessage) {
            try {
                const res = el.evaluate(expr, variables);
                console.log("This expression should have caused an error: " + expr, {
                    res
                });
                expect(true).toBe(false);
            }
            catch(err) {
                expect(err.message).toContain(expectedExceptionMessage);
            }
        }
        else {
            const res = el.evaluate(expr, variables);
            expect(res).toBe(expectedResult);
        }
    }
});

function getTernary() {
    return [
        ["a ? 'yes' : 'no'", {a: true}, 'yes'],
        ['a ? "yes" : "no"', {a: true}, 'yes'],
        ['a ? \'yes\' : \'no\'', {a: false}, 'no'],
        ['a ? \'yes\' : \'no\'', {a: null}, 'no'],
        ['a ? \'yes\' : \'no\'', {}, 'no', 'Variable "a" is not valid'],
        ['a ?: "short-hand"', {a: "find me"}, "find me"],
        ['a ?: "short-hand"', {a: false}, "short-hand"],
        // like Symfony, a missing else branch is null (it is NOT an elvis operator)
        ['a ? b', {a: false, b: 'yay'}, null],
        ['a ? b', {a: true, b: 'yay'}, 'yay'],
        ['a ? \'yes\'', {a: false}, null],
        ['a ? \'yes\'', {a: true}, 'yes'],
    ]
}

test('null safe compile', () => {
    let el = new ExpressionLanguage();
    for (let oneNullSafe of getNullSafe()) {
        let result = el.compile(oneNullSafe[0], ['foo']);
        const foo = oneNullSafe[1];
        expect(eval(result)).toBeFalsy();
    }
});

test('null safe evaluate', () => {
    let el = new ExpressionLanguage();
    for (let oneNullSafe of getNullSafe()) {
        let result = el.evaluate(oneNullSafe[0], {foo: oneNullSafe[1]});
        expect(result).toBeNull();
    }
})

test('null coalescing evaluate returns default', () => {
    const el = new ExpressionLanguage();
    for (const [expr, foo] of getNullCoalescing()) {
        expect(el.evaluate(expr, {foo})).toBe('default');
    }
});

test('null coalescing compile returns default', () => {
    const el = new ExpressionLanguage();
    for (const [expr, foo] of getNullCoalescing()) {
        const res = el.evaluate(expr, {foo});
        expect(res).toBe("default");
    }
});

function getNullSafe() {
    let foo = {
        bar: () => {
            return null;
        }
    };

    return [
        ['foo?.bar', null],
        ['foo?.bar()', null],
        ['foo.bar?.baz', {bar: null}],
        ['foo.bar?.baz()', {bar: null}],
        ['foo["bar"]?.baz', {bar: null}],
        ['foo["bar"]?.baz()', {bar: null}],
        ['foo.bar()?.baz', foo],
        ['foo.bar()?.baz()', foo],

        ['foo?.bar.baz', null],
        ['foo?.bar["baz"]', null],
        ['foo?.bar["baz"]["qux"]', null],
        ['foo?.bar["baz"]["qux"].quux', null],
        ['foo?.bar["baz"]["qux"].quux()', null],
        ['foo?.bar().baz', null],
        ['foo?.bar()["baz"]', null],
        ['foo?.bar()["baz"]["qux"]', null],
        ['foo?.bar()["baz"]["qux"].quux', null],
        ['foo?.bar()["baz"]["qux"].quux()', null]
    ]
}

function getNullCoalescing() {
    const foo = {
        bar: () => null
    };

    return [
        ['bar ?? "default"', null],
        ['foo.bar ?? "default"', null],
        ['foo.bar.baz ?? "default"', ({bar: null})],
        ['foo.bar ?? foo.baz ?? "default"', null],
        ['foo[0] ?? "default"', []],
        ['foo["bar"] ?? "default"', ({bar: null})],
        ['foo["baz"] ?? "default"', ({bar: null})],
        ['foo["bar"]["baz"] ?? "default"', ({bar: null})],
        ['foo["bar"].baz ?? "default"', ({bar: null})],
        ['foo.bar().baz ?? "default"', foo],
        ['foo.bar.baz.bam ?? "default"', ({bar: null})],
        ['foo?.bar?.baz?.qux ?? "default"', ({bar: null})],
        ['foo[123][456][789] ?? "default"', ({123: []})],
    ];
}

test('evaluate', () => {
    let evaluateData = getEvaluateData();

    for (let evaluateDatum of evaluateData) {
        let expressionLanguage = new ExpressionLanguage(),
            provider = evaluateDatum[3],
            expression = evaluateDatum[0],
            values = evaluateDatum[1],
            expectedOutcome = evaluateDatum[2];

        if (provider) {
            expressionLanguage.registerProvider(provider);
        }

        let result = expressionLanguage.evaluate(expression, values);

        if (expectedOutcome !== null && typeof expectedOutcome === "object") {
            expect(result).toMatchObject(expectedOutcome);
        } else {
            expect(result).toBe(expectedOutcome);
        }
    }
});

function getEvaluateData() {
    return [
        [
            // Expression
            '1.0',
            // Values
            {},
            // Expected Outcome
            1,
            // Provider
            null
        ],
        [
            // Expression
            '1 + 1',
            // Values
            {},
            // Expected Outcome
            2,
            // Provider
            null
        ],
        [
            // Expression
            '2 ** 3',
            // Values
            {},
            // Expected Outcome
            8,
            // Provider
            null
        ],
        [
            // Expression
            'a > 0',
            // Values
            {a: 1},
            // Expected Outcome
            true,
            // Provider
            null
        ],
        [
            // Expression
            'a >= 0',
            // Values
            {a: 1},
            // Expected Outcome
            true,
            // Provider
            null
        ],
        [
            // Expression
            'a <= 0',
            // Values
            {a: 1},
            // Expected Outcome
            false,
            // Provider
            null
        ],
        [
            // Expression
            'a != 0',
            // Values
            {a: 1},
            // Expected Outcome
            true,
            // Provider
            null
        ],
        [
            // Expression
            'a == 1',
            // Values
            {a: 1},
            // Expected Outcome
            true,
            // Provider
            null
        ],
        [
            // Expression
            'a === 1',
            // Values
            {a: 1},
            // Expected Outcome
            true,
            // Provider
            null
        ],
        [
            // Expression
            'a !== 1',
            // Values
            {a: 1},
            // Expected Outcome
            false,
            // Provider
            null
        ],
        [
            'foo.getFirst() + bar.getSecond()',
            {
                foo: {
                    getFirst: () => {
                        return 7;
                    }
                },
                bar: {
                    getSecond: () => {
                        return 100;
                    }
                }
            },
            107,
            null
        ],
        [
            '(foo.getFirst() + bar.getSecond()) / foo.second',
            {
                foo: {
                    second: 4,
                    getFirst: () => {
                        return 7;
                    }
                },
                bar: {
                    getSecond: () => {
                        return 9;
                    }
                }
            },
            4,
            null
        ],
        [
            'foo.getFirst() + bar.getSecond() / foo.second',
            {
                foo: {
                    second: 4,
                    getFirst: () => {
                        return 7;
                    }
                },
                bar: {
                    getSecond: () => {
                        return 8;
                    }
                }
            },
            9,
            null
        ],
        [
            '(foo.getFirst() + bar.getSecond() / foo.second) + bar.first[3]',
            {
                foo: {
                    getFirst: () => {
                        return 7;
                    },
                    second: 4
                },
                bar: {
                    first: [1, 2, 3, 4, 5],
                    getSecond: () => {
                        return 8;
                    }
                }
            },
            13,
            null
        ],
        [
            'b.myMethod(a[1])',
            {
                a: ["one", "two", "three"],
                b: {
                    myProperty: "foo",
                    myMethod: (word) => {
                        return "bar " + word;
                    }
                }
            },
            "bar two",
            null
        ],
        [
            'a[2] === "three" and b.myMethod(a[1]) === "bar two" and (b.myProperty == "foo" or b["myProperty"] == "foo") and b["property with spaces and &*()*%$##@% characters"] == "fun"',
            {
                a: ["one", "two", "three"],
                b: {
                    myProperty: "foo",
                    myMethod: (word) => {
                        return "bar " + word;
                    },
                    ["property with spaces and &*()*%$##@% characters"]: 'fun'
                }
            },
            true,
            null
        ],
        [
            'a and !b',
            {
                a: true,
                b: false
            },
            true,
            null
        ],
        [
            'a in b',
            {
                a: "Dogs",
                b: ["Cats", "Dogs"]
            },
            true,
            null
        ],
        [
            'a in outputs["typesOfAnimalsAllowed"]',
            {
                a: "Dogs",
                outputs: {
                    typesOfAnimalsAllowed: ["Dogs", "Other"]
                }
            },
            true,
            null
        ],
        [
            '"Other" in inputs["typesOfAnimalsAllowed"]',
            {
                inputs: {
                    typesOfAnimalsAllowed: ["Dogs", "Other"]
                }
            },
            true
        ],
        [
            'a not in b',
            {
                a: "Dogs",
                b: ["Cats", "Bags"]
            },
            true,
            null
        ]
    ];
}

// ---------------------------------------------------------------------------------------------------------
// string operators: case-sensitive by default, case-insensitive on request
// ---------------------------------------------------------------------------------------------------------

const STRING_OPERATOR_EXPRESSIONS = [
    ['"Hello World" contains "hello"', false, true],
    ['"Hello World" contains "World"', true, true],
    ['"Hello World" starts with "HELLO"', false, true],
    ['"Hello World" starts with "Hello"', true, true],
    ['"Hello World" ends with "WORLD"', false, true],
    ['"Hello World" ends with "World"', true, true],
    ['"Hello World" contains "xyz"', false, false],
];

test('contains, starts with and ends with are case-sensitive by default', () => {
    const el = new ExpressionLanguage();

    for (const [expression, caseSensitiveResult] of STRING_OPERATOR_EXPRESSIONS) {
        expect(el.evaluate(expression)).toBe(caseSensitiveResult);
        expect(compiledResult(el, expression)).toBe(caseSensitiveResult);
    }
});

test('the caseInsensitiveStringOperators option makes them ignore case', () => {
    const el = new ExpressionLanguage(null, [], {caseInsensitiveStringOperators: true});

    for (const [expression, , caseInsensitiveResult] of STRING_OPERATOR_EXPRESSIONS) {
        expect(el.evaluate(expression)).toBe(caseInsensitiveResult);
        expect(compiledResult(el, expression)).toBe(caseInsensitiveResult);
    }
});

test('the option does not leak into other instances', () => {
    new ExpressionLanguage(null, [], {caseInsensitiveStringOperators: true});

    expect(new ExpressionLanguage().evaluate('"ABC" contains "b"')).toBe(false);
});

test('the CASE_INSENSITIVE_STRING_OPERATORS flag does the same for a single parse() / lint()', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate(el.parse('"ABC" contains "b"', [], CASE_INSENSITIVE_STRING_OPERATORS))).toBe(true);
    // ...without altering what the same expression means when parsed without the flag (the cache is keyed by flags)
    expect(el.evaluate('"ABC" contains "b"')).toBe(false);
    expect(el.evaluate(el.parse('"ABC" contains "b"', [], CASE_INSENSITIVE_STRING_OPERATORS))).toBe(true);
    expect(() => el.lint('"ABC" contains "b"', [], CASE_INSENSITIVE_STRING_OPERATORS)).not.toThrow();
});

test('the flag only concerns the three string operators', () => {
    const el = new ExpressionLanguage(null, [], {caseInsensitiveStringOperators: true});

    expect(el.evaluate('"ABC" == "abc"')).toBe(false);
    expect(el.evaluate('"ABC" matches "/abc/"')).toBe(false);
    expect(el.evaluate('"ABC" in ["abc"]')).toBe(false);
});

test('string operators treat null as an empty string and numbers as their digits', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate('a contains ""', {a: null})).toBe(true);
    expect(el.evaluate('a contains "x"', {a: null})).toBe(false);
    expect(el.evaluate('123 contains 2')).toBe(true);
    expect(el.evaluate('a starts with 1', {a: 12})).toBe(true);
});

// ---------------------------------------------------------------------------------------------------------
// the parse cache
// ---------------------------------------------------------------------------------------------------------

test('the parse cache is keyed by the flags as well', () => {
    const el = new ExpressionLanguage();

    // parsed first while ignoring unknown variables...
    expect(el.parse('foo', [], IGNORE_UNKNOWN_VARIABLES)).toBeDefined();
    // ...which must not let the same expression through when the variable is required
    expect(() => el.parse('foo', [])).toThrow('Variable "foo" is not valid');
    expect(() => el.parse('foo', [], 0)).toThrow(ELSyntaxError);
});

test('parse() returns the same ParsedExpression for the same expression, names and flags', () => {
    const el = new ExpressionLanguage();

    expect(el.parse('a + b', ['a', 'b'])).toBe(el.parse('a + b', ['b', 'a']));
    expect(el.parse('a + b', ['a', 'b'])).not.toBe(el.parse('a + b', ['a', 'b'], IGNORE_UNKNOWN_FUNCTIONS));
});

test('parse() leaves the names array of the caller untouched', () => {
    const el = new ExpressionLanguage();
    const names = ['b', 'a'];

    el.parse('a + b', names);
    el.compile('a + b', names);
    el.lint('a + b', names);

    expect(names).toEqual(['b', 'a']);
});

// ---------------------------------------------------------------------------------------------------------
// error messages
// ---------------------------------------------------------------------------------------------------------

test('syntax errors carry their position, expression and a suggestion in their message', () => {
    const el = new ExpressionLanguage();

    expect(() => el.evaluate('nam', {name: 1})).toThrow('Variable "nam" is not valid around position 1 for expression `nam`. Did you mean "name"?');
    expect(() => el.evaluate('minn(1)')).toThrow('The function "minn" does not exist around position 1 for expression `minn(1)`. Did you mean "min"?');
    expect(() => el.evaluate('1 +')).toThrow('Unexpected token "end of expression" of value "" around position 4 for expression `1 +`.');
});

// ---------------------------------------------------------------------------------------------------------
// objects & arrays
// ---------------------------------------------------------------------------------------------------------

test('methods are called on their object, so they can use `this`', () => {
    class Greeter {
        constructor(name) { this.name = name; }
        greet(greeting) { return greeting + ', ' + this.name; }
    }
    const el = new ExpressionLanguage();

    expect(el.evaluate('g.greet("Hello")', {g: new Greeter('World')})).toBe('Hello, World');
    expect(el.evaluate('g?.greet("Hi")', {g: new Greeter('there')})).toBe('Hi, there');
});

test('null-safe array access: foo?.[0]', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate('foo?.[0]', {foo: null})).toBeNull();
    expect(el.evaluate('foo?.[0]', {foo: [5]})).toBe(5);
    expect(el.evaluate('foo?.[0].bar', {foo: null})).toBeNull();
    expect(el.evaluate('foo?.[0]?.bar', {foo: [null]})).toBeNull();
    expect(el.evaluate('foo?.[0]?.bar', {foo: [{bar: 3}]})).toBe(3);
    expect(el.evaluate('foo?.bar?.[1]', {foo: {bar: [8, 9]}})).toBe(9);
    expect(el.evaluate('foo?.[0] ?? "default"', {foo: null})).toBe('default');

    expect(() => el.evaluate('foo?.[0].bar', {foo: [null]})).toThrow('Unable to get property "bar" of non-object "foo?.[0]".');
    expect(() => el.evaluate('foo?.[0]', {foo: 5})).toThrow('Unable to get an item of non-array "foo".');
    expect(() => el.evaluate('foo.[0]', {foo: [1]})).toThrow('Expected name');

    for (const [expression, values] of [['foo?.[0]', {foo: null}], ['foo?.[0]', {foo: [5]}], ['foo?.bar?.[1]', {foo: {bar: [8, 9]}}], ['foo?.[0] ?? "d"', {foo: null}]]) {
        expect(compiledResult(el, expression, ['foo'], [values.foo]) ?? null).toBe(el.evaluate(expression, values));
    }
});

test('a `?.` chain evaluated twice with different values does not remember the first evaluation', () => {
    const el = new ExpressionLanguage();
    const parsed = el.parse('a?.b.c', ['a']);

    expect(el.evaluate(parsed, {a: null})).toBeNull();
    expect(el.evaluate(parsed, {a: {b: {c: 1}}})).toBe(1);
    expect(() => el.evaluate(parsed, {a: {b: null}})).toThrow('Unable to get property "c" of non-object "a?.b".');
});

test('expressions cannot reach constructors or prototypes through properties, methods or items', () => {
    const el = new ExpressionLanguage();

    for (const expression of [
        'o.constructor',
        'o.constructor.constructor',
        'o.__proto__',
        'o.__proto__.constructor',
        'o["constructor"]',
        'o["__proto__"]',
        'o.constructor("return process")',
        'o.__defineGetter__("x", 1)',
        'a.constructor',
        'a["__proto__"]',
        '({})["constructor"]',
    ]) {
        expect(() => el.evaluate(expression, {o: {x: 1}, a: [1]})).toThrow(/Access to "[_a-zA-Z]+" is not allowed|Unable to/);
    }
});

test('data that merely has a key named like a prototype member is still readable', () => {
    const el = new ExpressionLanguage();
    const data = JSON.parse('{"constructor": "mine", "prototype": 1, "__proto__": {"x": 1}}');

    expect(el.evaluate('d.constructor', {d: data})).toBe('mine');
    expect(el.evaluate('d["prototype"]', {d: data})).toBe(1);
});

test('a hash literal with a "__proto__" key is a plain entry and does not change the prototype', () => {
    const el = new ExpressionLanguage();
    const result = el.evaluate('{"__proto__": {"polluted": 1}, "other": 2}');

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result)).toEqual(['__proto__', 'other']);
    expect(({}).polluted).toBeUndefined();
});

test('a hash literal with a computed key compiles to a computed property name', () => {
    const el = new ExpressionLanguage();

    expect(compiledResult(el, '{a: 1, (1 + 1): 2, "b": 3}')).toEqual({a: 1, 2: 2, b: 3});
});

test('string literals follow PHP: control characters are unescaped, other escapes lose their backslash', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate('"a\\nb"')).toBe('a\nb');
    expect(el.evaluate('"\\x41\\101"')).toBe('AA');
    expect(el.evaluate('"\\d"')).toBe('d');
    expect(compiledResult(el, '"a\\nb\\tc"')).toBe('a\nb\tc');
    // regexes therefore need their backslashes doubled, as they do with Symfony
    expect(el.evaluate('"5" matches "/^\\\\d$/"')).toBe(true);
    // ...because a single one is gone before the regex sees it: "/^\\d$/" is the pattern /^d$/
    expect(el.evaluate('"d" matches "/^\\d$/"')).toBe(true);
    expect(el.evaluate('"5" matches "/^\\d$/"')).toBe(false);
});

test('division and modulo by zero throw a DivisionByZeroError', () => {
    const el = new ExpressionLanguage();

    expect(() => el.evaluate('1 / 0')).toThrow(DivisionByZeroError);
    expect(() => el.evaluate('a % b', {a: 5, b: 0})).toThrow('Modulo by zero.');
    expect(el.evaluate('0 / 5')).toBe(0);
    expect(el.evaluate('7 % 3')).toBe(1);
});

test('logical operators yield booleans', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate('0 || 5')).toBe(true);
    expect(el.evaluate('"a" && "b"')).toBe(true);
    expect(el.evaluate('"" or null')).toBe(false);
    expect(el.evaluate('a and b', {a: 1, b: 0})).toBe(false);
});

test('word operators work right before an opening parenthesis', () => {
    const el = new ExpressionLanguage();

    expect(el.evaluate('not(true)')).toBe(false);
    expect(el.evaluate('true and(false)')).toBe(false);
    expect(el.evaluate('false or(true)')).toBe(true);
});

// ---------------------------------------------------------------------------------------------------------
// semantics: Symfony's rules (the default), JavaScript's, or both ("portable")
// ---------------------------------------------------------------------------------------------------------

describe('semantics', () => {
    const outcome = (callback) => {
        try {
            return callback();
        } catch (e) {
            return e.name;
        }
    };

    test('are Symfony\'s by default: an expression gives here what it gives in PHP', () => {
        const el = new ExpressionLanguage();

        expect(el.evaluate('"5" + 1')).toBe(6);
        expect(el.evaluate('a == b', {a: null, b: false})).toBe(true);
        expect(el.evaluate('"10" < "9"')).toBe(false);
        expect(el.evaluate('a ? "yes" : "no"', {a: '0'})).toBe('no');
        expect(el.evaluate('a ?: "d"', {a: []})).toBe('d');
        expect(el.evaluate('1 << 40')).toBe(1099511627776);
        expect(el.evaluate('a === b', {a: [1, 2], b: [1, 2]})).toBe(true);
        expect(el.evaluate('a in b', {a: [1], b: [[1], [2]]})).toBe(true);
        expect(el.evaluate('a ~ b', {a: true, b: 1.5})).toBe('11.5');
        expect(outcome(() => el.evaluate('"abc" + 1'))).toBe('TypeError');
        expect(outcome(() => el.evaluate('list.length', {list: [1, 2]}))).toBe('Error');
    });

    test('can be JavaScript\'s', () => {
        const el = new ExpressionLanguage(null, [], {semantics: 'js'});

        expect(el.evaluate('"5" + 1')).toBe('51');
        expect(el.evaluate('a == b', {a: null, b: false})).toBe(false);
        expect(el.evaluate('"10" < "9"')).toBe(true);
        expect(el.evaluate('a ? "yes" : "no"', {a: '0'})).toBe('yes');
        expect(el.evaluate('1 << 40')).toBe(256);
        expect(el.evaluate('a === b', {a: [1, 2], b: [1, 2]})).toBe(false);
        expect(el.evaluate('a ~ b', {a: true, b: 1.5})).toBe('true1.5');
        expect(el.evaluate('"abc" + 1')).toBe('abc1');
        expect(el.evaluate('list.length', {list: [1, 2]})).toBe(2);
    });

    test('can be both ("portable"): what they agree on is returned, the rest is an error', () => {
        const el = new ExpressionLanguage(null, [], {semantics: 'portable'});

        expect(el.evaluate('a + b * 2 > 5 and name starts with "A"', {a: 1, b: 3, name: 'Ann'})).toBe(true);
        expect(el.evaluate('"abc" ~ 1')).toBe('abc1');
        expect(outcome(() => el.evaluate('"5" + 1'))).toBe('PortabilityError');
        expect(outcome(() => el.evaluate('a == b', {a: 0, b: ''}))).toBe('PortabilityError');
        expect(outcome(() => el.evaluate('a ? 1 : 2', {a: '0'}))).toBe('PortabilityError');
        expect(outcome(() => el.evaluate('a ? 1 : 2', {a: 'x'}))).toBe(1);
        expect(el.evaluate('a ? 1 : 2', {a: 'x'})).toBe(1);
        expect(outcome(() => el.evaluate('1 << 40'))).toBe('PortabilityError');
        expect(outcome(() => el.evaluate('list.length', {list: [1]}))).toBe('Error');
    });

    test('an unknown one is refused', () => {
        expect(() => new ExpressionLanguage(null, [], {semantics: 'php'})).toThrow('Unknown semantics "php": use "symfony", "js", "portable".');
        expect(() => new ExpressionLanguage(null, [], {semantics: 'js'})).not.toThrow();
        expect(() => new ExpressionLanguage(null, [], {semantics: 'symfony'})).not.toThrow();
        expect(() => new ExpressionLanguage(null, [], {})).not.toThrow();
    });

    test('are chosen for one call by a flag, which wins over the option', () => {
        const symfony = new ExpressionLanguage();
        const js = new ExpressionLanguage(null, [], {semantics: 'js'});
        const portable = new ExpressionLanguage(null, [], {semantics: 'portable'});

        expect(symfony.evaluate(symfony.parse('"5" + 1', [], SEMANTICS_JS))).toBe('51');
        expect(symfony.evaluate('"5" + 1')).toBe(6);
        expect(js.evaluate(js.parse('"5" + 1', []))).toBe('51');
        expect(outcome(() => js.evaluate(js.parse('"5" + 1', [], SEMANTICS_PORTABLE)))).toBe('PortabilityError');
        expect(outcome(() => portable.evaluate(portable.parse('"5" + 1', [], SEMANTICS_JS)))).toBe('51');
        // the flags of the option other than the semantics are kept
        const insensitive = new ExpressionLanguage(null, [], {semantics: 'js', caseInsensitiveStringOperators: true});
        expect(insensitive.evaluate(insensitive.parse('"ABC" contains "b"', [], 0))).toBe(true);
        expect(insensitive.evaluate(insensitive.parse('"ABC" contains "b"', [], SEMANTICS_PORTABLE))).toBe(true);
        expect(insensitive.defaultFlags).toBe(CASE_INSENSITIVE_STRING_OPERATORS | SEMANTICS_JS);
    });

    test('cannot be two at once', () => {
        const el = new ExpressionLanguage();

        expect(() => el.parse('1 + 1', [], SEMANTICS_JS | SEMANTICS_PORTABLE)).toThrow('SEMANTICS_JS and SEMANTICS_PORTABLE exclude each other.');
        expect(() => el.parse('1 + 1', [], SEMANTICS_JS | SEMANTICS_PORTABLE)).toThrow(LogicException);
    });

    test('are part of the parse cache key: the same expression is parsed once per semantics', () => {
        const cache = new ArrayAdapter();
        const symfony = new ExpressionLanguage(cache);
        const js = new ExpressionLanguage(cache, [], {semantics: 'js'});

        expect(symfony.evaluate('"5" + 1')).toBe(6);
        expect(js.evaluate('"5" + 1')).toBe('51');
        expect(symfony.evaluate('"5" + 1')).toBe(6);
        expect(symfony.parse('"5" + 1', [])).not.toBe(js.parse('"5" + 1', []));
    });

    test('are remembered by a parsed expression, wherever it is evaluated', () => {
        const parsedAsJs = new ExpressionLanguage(null, [], {semantics: 'js'}).parse('a + b', ['a', 'b']);
        const restored = ParsedExpression.fromJSON(JSON.stringify(parsedAsJs));

        expect(new ExpressionLanguage().evaluate(parsedAsJs, {a: '5', b: 1})).toBe('51');
        expect(new ExpressionLanguage().evaluate(restored, {a: '5', b: 1})).toBe('51');
        expect(restored.getNodes().attributes.semantics).toBe('js');
        // the default is not written down
        expect(new ExpressionLanguage().parse('a + b', ['a', 'b']).getNodes().attributes.semantics).toBeUndefined();
        expect(new ExpressionLanguage().evaluate(ParsedExpression.fromJSON(JSON.stringify(new ExpressionLanguage().parse('a + b', ['a', 'b']))), {a: '5', b: 1})).toBe(6);
    });

    test('apply to every operator of an expression, not only the first', () => {
        const symfony = new ExpressionLanguage();
        const js = new ExpressionLanguage(null, [], {semantics: 'js'});
        const expression = 'a + 1 == "6" and (b ? "t" : "f") == "f" and not c';
        const values = {a: '5', b: '0', c: []};

        expect(symfony.evaluate(expression, values)).toBe(true);
        expect(js.evaluate(expression, values)).toBe(false);
    });

    test('the compiled code of the default ones needs the runtime, the one of the "js" ones needs nothing', () => {
        const symfony = new ExpressionLanguage();
        const js = new ExpressionLanguage(null, [], {semantics: 'js'});

        expect(symfony.compile('a + b', ['a', 'b'])).toBe('__runtime.symfony.add(a, b)');
        expect(new ExpressionLanguage(null, [], {semantics: 'portable'}).compile('a + b', ['a', 'b'])).toBe('__runtime.portable.add(a, b)');
        expect(js.compile('a + b', ['a', 'b'])).toBe('(a + b)');
        expect(new Function('a', 'b', 'return ' + js.compile('a + b', ['a', 'b']) + ';')('5', 1)).toBe('51');
        expect(compiledResult(symfony, 'a + b', ['a', 'b'], ['5', 1])).toBe(6);
        expect(() => new Function('a', 'b', 'return ' + symfony.compile('a + b', ['a', 'b']) + ';')('5', 1)).toThrow('__runtime is not defined');
    });

    test('lint is done with the same flags', () => {
        const el = new ExpressionLanguage(null, [], {semantics: 'js'});

        expect(() => el.lint('a + b', ['a', 'b'])).not.toThrow();
        expect(() => el.lint('a + b', ['a'])).toThrow('Variable "b" is not valid');
    });
});
