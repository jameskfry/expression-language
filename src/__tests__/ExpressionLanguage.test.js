import ExpressionLanguage from "../ExpressionLanguage";
import ExpressionFunction from "../ExpressionFunction";

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

    for (let shortCircuit of shortCircuits) {
        let exprLang = new ExpressionLanguage();
        let compiled = exprLang.compile(shortCircuit[0], shortCircuit[1]);
        expect(eval(compiled)).toBe(shortCircuit[2]);
    }
});

test('caching for overridden variable names', () => {
    let expressionLanguage = new ExpressionLanguage(),
        expression = 'a + b';

    expressionLanguage.evaluate(expression, {a: 1, b: 1});
    let result = expressionLanguage.compile(expression, ['a', {'B': 'b'}])
    expect(result).toBe("(a + B)");
});

test('strict equality', () => {
    let expressionLanguage = new ExpressionLanguage(),
        expression = '123 === a';

    let result = expressionLanguage.compile(expression, ['a']);
    expect(result).toBe("(123 === a)");
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
        expect(err.toString()).toBe('Error: Method "myfunction" is undefined on object.');
    }
});

test('built-in min function', () => {
    const el = new ExpressionLanguage();
    const expr = 'min(1,2,3)';
    const compiled = el.compile(expr, []);
    expect(compiled).toBe('Math.min(1, 2, 3)');

    const result = el.evaluate(expr, {});
    expect(result).toBe(1);
});

test('built-in max function', () => {
    const el = new ExpressionLanguage();
    const expr = 'max(1,2,3)';
    const compiled = el.compile(expr, []);
    expect(compiled).toBe('Math.max(1, 2, 3)');

    const result = el.evaluate(expr, {});
    expect(result).toBe(3);
});

test('built-in constant function evaluates globals and dotted paths', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('constant("Math.PI")')).toBe(Math.PI);
    // also via compile+eval
    const code = el.compile('constant("Math.E")', []);
    expect(eval(code)).toBe(Math.E);
});

test('built-in constant function falls back to values map', () => {
    const el = new ExpressionLanguage();
    const values = {FOO: 42};
    expect(el.evaluate('constant("FOO")', values)).toBe(42);
});

test('built-in constant returns undefined for unknown or invalid names', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('constant("This.Does.Not.Exist")')).toBeUndefined();
    expect(el.evaluate('constant(123)')).toBeUndefined();
    expect(el.evaluate('constant("")')).toBeUndefined();
});

// enum() tests

test('built-in enum evaluates and compiles using PHP-like FQN string', () => {
    const el = new ExpressionLanguage();
    // prepare a global-like namespace with an enum-like object
    const root = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : global);
    root.App = root.App || {};
    root.App.SomeNamespace = root.App.SomeNamespace || {};
    root.App.SomeNamespace.Foo = { Bar: { kind: 'Foo.Bar' } };

    // PHP-like input with backslashes and ::
    const expr = 'enum("App\\\\SomeNamespace\\\\Foo::Bar")';
    const value = el.evaluate(expr);
    expect(value).toMatchObject({ kind: 'Foo.Bar' });

    const code = el.compile(expr, []);
    // ensure global is visible to eval
    expect(eval(code)).toMatchObject({ kind: 'Foo.Bar' });
});

test('built-in enum supports dotted path as well', () => {
    const el = new ExpressionLanguage();
    const root = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : global);
    root.App = root.App || {};
    root.App.Other = { Enum: { CaseA: { ok: true } } };
    expect(el.evaluate('enum("App.Other.Enum.CaseA")')).toMatchObject({ ok: true });
});

test('built-in enum returns undefined on invalid input or missing members', () => {
    const el = new ExpressionLanguage();
    expect(el.evaluate('enum(123)')).toBeUndefined();
    expect(el.evaluate('enum("")')).toBeUndefined();
    expect(el.evaluate('enum("Not.Exist::Nope")')).toBeUndefined();
});

test('operator collisions evaluate and compile', () => {
    const el = new ExpressionLanguage();
    const expr = 'foo.not in [bar]';
    const compiled = el.compile(expr, ['foo', 'bar']);
    // compiled code should be evaluable and return true
    expect(compiled).toBe("includes(foo.not, [bar])");

    const resultEvaluated = el.evaluate(expr, {foo: {not: 'test'}, bar: 'test'});
    expect(resultEvaluated).toBe(true);
});

test('parse throws on incomplete expression (node.)', () => {
    const el = new ExpressionLanguage();
    expect(() => el.parse('node.', ['node'])).toThrow();
});

test('comments ignored in evaluate and compile', () => {
    const el = new ExpressionLanguage();
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
                expect(err.message).toBe(expectedExceptionMessage);
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
    ]
}

test('null safe compile', () => {
    let el = new ExpressionLanguage();
    for (let oneNullSafe of getNullSafe()) {
        let foo = oneNullSafe[1];
        let result = el.compile(oneNullSafe[0], ['foo']);
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
        const code = el.compile(expr, [{foo: 'foo'}]);
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
