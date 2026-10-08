import GetAttrNode from "../GetAttrNode";
import ArrayNode from "../ArrayNode";
import ConstantNode from "../ConstantNode";
import NameNode from "../NameNode";
import Compiler from "../../Compiler";
import ArgumentsNode from "../ArgumentsNode";

function getArrayNode() {
    let arr = new ArrayNode();
    arr.addElement(new ConstantNode('a'), new ConstantNode('b'));
    arr.addElement(new ConstantNode('b'));

    return arr;
}

class Obj {
    foo = 'bar';
    fooFn = () => {
        return 'baz';
    }
}

function getEvaluateData() {
    return [
        ['b', new GetAttrNode(new NameNode('foo'), new ConstantNode('0'), getArrayNode(), GetAttrNode.ARRAY_CALL), {
            foo: {
                b: 'a',
                '0': 'b'
            }
        }],
        ['a', new GetAttrNode(new NameNode('foo'), new ConstantNode('b'), getArrayNode(), GetAttrNode.ARRAY_CALL), {
            foo: {
                b: 'a',
                '0': 'b'
            }
        }],

        ['bar', new GetAttrNode(new NameNode('foo'), new ConstantNode('foo'), getArrayNode(), GetAttrNode.PROPERTY_CALL), {foo: new Obj()}],

        ['baz', new GetAttrNode(new NameNode('foo'), new ConstantNode('fooFn'), getArrayNode(), GetAttrNode.METHOD_CALL), {foo: new Obj()}],
        ['a', new GetAttrNode(new NameNode('foo'), new NameNode('index'), getArrayNode(), GetAttrNode.ARRAY_CALL), {
            foo: {
                b: 'a',
                '0': 'b'
            },
            index: 'b'
        }],
    ];
}

function getCompileData() {
    return [
        ['foo[0]', new GetAttrNode(new NameNode('foo'), new ConstantNode(0), getArrayNode(), GetAttrNode.ARRAY_CALL)],
        ['foo["b"]', new GetAttrNode(new NameNode('foo'), new ConstantNode('b'), getArrayNode(), GetAttrNode.ARRAY_CALL)],

        ['foo.foo', new GetAttrNode(new NameNode('foo'), new ConstantNode('foo'), getArrayNode(), GetAttrNode.PROPERTY_CALL), {foo: new Obj()}],

        ['foo.fooFn({"b": "a", 0: "b"})', new GetAttrNode(new NameNode('foo'), new ConstantNode('fooFn'), getArrayNode(), GetAttrNode.METHOD_CALL), {foo: new Obj()}
        ],
        ['foo[index]', new GetAttrNode(new NameNode('foo'), new NameNode('index'), getArrayNode(), GetAttrNode.ARRAY_CALL)],
    ];
}

function getDumpData() {
    return [
        ['foo[0]', new GetAttrNode(new NameNode('foo'), new ConstantNode(0), getArrayNode(), GetAttrNode.ARRAY_CALL)],
        ['foo["b"]', new GetAttrNode(new NameNode('foo'), new ConstantNode('b'), getArrayNode(), GetAttrNode.ARRAY_CALL)],

        ['foo.foo', new GetAttrNode(new NameNode('foo'), new NameNode('foo'), getArrayNode(), GetAttrNode.PROPERTY_CALL), {foo: new Obj()}],

        ['foo.fooFn({"0": "b", "b": "a"})', new GetAttrNode(new NameNode('foo'), new NameNode('fooFn'), getArrayNode(), GetAttrNode.METHOD_CALL), {foo: new Obj()}
        ],
        ['foo[index]', new GetAttrNode(new NameNode('foo'), new NameNode('index'), getArrayNode(), GetAttrNode.ARRAY_CALL)],
        ['foo?.fooFn()', new GetAttrNode(new NameNode('foo'), new ConstantNode('fooFn', true, true), new ArgumentsNode(), GetAttrNode.METHOD_CALL)]
    ];
}

test('evaluate GetAttrNode', () => {
    for (let evaluateParams of getEvaluateData()) {
        //console.log("Evaluating: ", evaluateParams);
        let evaluated = evaluateParams[1].evaluate(evaluateParams[3]||{}, evaluateParams[2]);
        //console.log("Evaluated: ", evaluated);
        if (evaluateParams[0] !== null && typeof evaluateParams[0] === "object") {
            expect(evaluated).toMatchObject(evaluateParams[0]);
        }
        else {
            expect(evaluated).toBe(evaluateParams[0]);
        }
    }
});

test('compile GetAttrNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump GetAttrNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});

test('dump renders a null-safe property access with "?." instead of "."', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true, true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);
    expect(node.dump()).toBe('foo?.bar');
});

test('evaluate throws when accessing a property on a non-object', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to get property "bar" of non-object "foo".');
});

test('evaluate throws when calling a method on a non-object', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to call method "bar" of non-object "foo".');
});

test('evaluate throws when calling an undefined method', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: {}})).toThrow('Unable to call method "bar" of object "Object".');
});

test('evaluate throws when the resolved property is not a function', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: {bar: 5}})).toThrow('Unable to call method "bar" of object "Object".');
});

test('evaluate throws when indexing a non-array, non-object value', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode(0), new ArgumentsNode(), GetAttrNode.ARRAY_CALL);
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to get an item of non-array "foo".');
});

test('methods are called on the object itself so they can use `this`', () => {
    class Counter {
        constructor() { this.count = 41; }
        next(by) { return this.count + by; }
    }
    let node = new GetAttrNode(new NameNode('c'), new ConstantNode('next', true), (() => {
        let args = new ArgumentsNode();
        args.addElement(new ConstantNode(1));
        return args;
    })(), GetAttrNode.METHOD_CALL);

    expect(node.evaluate({}, {c: new Counter()})).toBe(42);
});

test('evaluation keeps no state on the node: a short-circuit never leaks into the next evaluation', () => {
    let inner = new GetAttrNode(new NameNode('a'), new ConstantNode('b', true, true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);
    let outer = new GetAttrNode(inner, new ConstantNode('c', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);

    expect(outer.evaluate({}, {a: null})).toBeNull();
    // `a.b` is now null for real, and without a null-safe operator that must not be silently tolerated
    expect(() => outer.evaluate({}, {a: {b: null}})).toThrow('Unable to get property "c" of non-object "a?.b".');
});

test('null-safe array access short-circuits on null and reads items otherwise', () => {
    let node = new GetAttrNode(new NameNode('a'), new ConstantNode(0), new ArgumentsNode(), GetAttrNode.ARRAY_CALL, true);

    expect(node.evaluate({}, {a: null})).toBeNull();
    expect(node.evaluate({}, {a: [7]})).toBe(7);
    expect(() => node.evaluate({}, {a: 5})).toThrow('Unable to get an item of non-array "a".');
    expect(node.dump()).toBe('a?.[0]');
});

test('null-safe array access is only honored for array calls', () => {
    let node = new GetAttrNode(new NameNode('a'), new ConstantNode('b', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL, true);

    expect(node.attributes.is_null_safe).toBe(false);
});

test('null-safe array access compiles to optional chaining', () => {
    let node = new GetAttrNode(new NameNode('a'), new ConstantNode(0), new ArgumentsNode(), GetAttrNode.ARRAY_CALL, true);
    let compiler = new Compiler({});
    node.compile(compiler);

    expect(compiler.getSource()).toBe('a?.[0]');
});

test('inherited members that expose constructors and prototypes are not reachable', () => {
    for (const name of ['constructor', '__proto__', 'prototype', '__defineGetter__', '__lookupGetter__']) {
        for (const semantics of ['symfony', 'js', 'portable']) {
            let property = new GetAttrNode(new NameNode('foo'), new ConstantNode(name, true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL, false, semantics);
            let method = new GetAttrNode(new NameNode('foo'), new ConstantNode(name, true), new ArgumentsNode(), GetAttrNode.METHOD_CALL, false, semantics);
            let item = new GetAttrNode(new NameNode('foo'), new ConstantNode(name), new ArgumentsNode(), GetAttrNode.ARRAY_CALL, false, semantics);

            for (const node of [property, method, item]) {
                expect(() => node.evaluate({}, {foo: {}})).toThrow(`Access to "${name}" is not allowed.`);
            }
            // an array is no object in PHP: it has no properties, and the items of an array are guarded as well
            expect(() => item.evaluate({}, {foo: []})).toThrow(`Access to "${name}" is not allowed.`);
            const onArray = 'js' === semantics ? `Access to "${name}" is not allowed.` : 'Unable to';
            expect(() => property.evaluate({}, {foo: []})).toThrow(onArray);
            expect(() => method.evaluate({}, {foo: []})).toThrow(onArray);
        }
    }
});

test('an array has no properties nor methods unless the rules are JavaScript\'s', () => {
    const property = (semantics) => new GetAttrNode(new NameNode('list'), new ConstantNode('length', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL, false, semantics);
    const method = (semantics) => new GetAttrNode(new NameNode('list'), new ConstantNode('includes', true), (() => { let args = new ArgumentsNode(); args.addElement(new ConstantNode(2)); return args; })(), GetAttrNode.METHOD_CALL, false, semantics);

    for (const semantics of ['symfony', 'portable']) {
        expect(() => property(semantics).evaluate({}, {list: [1, 2]})).toThrow('Unable to get property "length" of non-object "list".');
        expect(() => method(semantics).evaluate({}, {list: [1, 2]})).toThrow('Unable to call method "includes" of non-object "list".');
        // ...but its items are readable
        expect(new GetAttrNode(new NameNode('list'), new ConstantNode(1), new ArgumentsNode(), GetAttrNode.ARRAY_CALL, false, semantics).evaluate({}, {list: [1, 2]})).toBe(2);
    }
    expect(property('js').evaluate({}, {list: [1, 2]})).toBe(2);
    expect(method('js').evaluate({}, {list: [1, 2]})).toBe(true);
    // an object is still an object
    expect(property('symfony').evaluate({}, {list: {length: 7}})).toBe(7);
});

test('an own property that happens to be named like a forbidden member stays readable', () => {
    let property = new GetAttrNode(new NameNode('foo'), new ConstantNode('constructor', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);

    expect(property.evaluate({}, {foo: {constructor: 'data'}})).toBe('data');
});
