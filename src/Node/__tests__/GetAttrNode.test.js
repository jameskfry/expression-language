import GetAttrNode from "../GetAttrNode";
import ArrayNode from "../ArrayNode";
import ConstantNode from "../ConstantNode";
import NameNode from "../NameNode";
import Compiler from "../../Compiler";

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