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
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to get property "bar" on a non-object: number');
});

test('evaluate throws when calling a method on a non-object', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to call method "bar" on a non-object: number');
});

test('evaluate throws when calling an undefined method', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: {}})).toThrow('Method "bar" is undefined on object.');
});

test('evaluate throws when the resolved property is not a function', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL);
    expect(() => node.evaluate({}, {foo: {bar: 5}})).toThrow('Method "bar" is not a function on object.');
});

test('evaluate throws when indexing a non-array, non-object value', () => {
    let node = new GetAttrNode(new NameNode('foo'), new ConstantNode(0), new ArgumentsNode(), GetAttrNode.ARRAY_CALL);
    expect(() => node.evaluate({}, {foo: 5})).toThrow('Unable to get an item on a non-array: number');
});