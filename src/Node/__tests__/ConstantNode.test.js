import ConstantNode from "../ConstantNode";
import Compiler from "../../Compiler";

function getEvaluateData() {
    return [
        [false, new ConstantNode(false)],
        [true, new ConstantNode(true)],
        [null, new ConstantNode(null)],
        [3, new ConstantNode(3)],
        [3.3, new ConstantNode(3.3)],
        ['foo', new ConstantNode('foo')],
        [{one: 1, b: 'a'}, new ConstantNode({one: 1, b: 'a'})]
    ]
}

function getCompileData() {
    return [
        ['false', new ConstantNode(false)],
        ['true', new ConstantNode(true)],
        ['null', new ConstantNode(null)],
        ['3', new ConstantNode(3)],
        ['3.3', new ConstantNode(3.3)],
        ['"foo"', new ConstantNode('foo')],
        ['{\"one\":1, \"b\":"a"}', new ConstantNode({one: 1, b: 'a'})]
    ];
}

function getDumpData() {
    return [
        ['false', new ConstantNode(false)],
        ['true', new ConstantNode(true)],
        ['null', new ConstantNode(null)],
        ['3', new ConstantNode(3)],
        ['3.3', new ConstantNode(3.3)],
        ['"foo"', new ConstantNode('foo')],
        ['foo', new ConstantNode('foo', true)],
        ['{"one": 1}', new ConstantNode({one: 1})],
        ['{\"one\": 1, "c": true, \"b\": "a"}', new ConstantNode({one: 1, c: true, b: 'a'})],
        ['["c","d"]', new ConstantNode(["c", "d"])],
        ['{"a": ["b"]}', new ConstantNode({a: ["b"]})]
    ]
}

test('evaluate ConstantNode', () => {
    for (let evaluateParams of getEvaluateData()) {
        if (evaluateParams[0] !== null && typeof evaluateParams[0] === "object") {
            expect(evaluateParams[1].evaluate({}, {})).toMatchObject(evaluateParams[0]);
        }
        else {
            expect(evaluateParams[1].evaluate({}, {})).toBe(evaluateParams[0]);
        }
    }
});

test('compile ConstantNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump ConstantNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});