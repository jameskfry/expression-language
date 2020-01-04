import ArrayNode from "../ArrayNode";
import ConstantNode from "../ConstantNode";
import Compiler from "../../Compiler";

function getEvaluateData() {
    return [
        [{b: 'a', "0": "b"}, getArrayNode()]
    ]
}

function getCompileData() {
    return [
        ['{"b": "a", "0": "b"}', getArrayNode()]
    ]
}

function getDumpData() {
    let arrOne = createArrayNode();
    arrOne.addElement(new ConstantNode("c"), new ConstantNode('a"b'));
    arrOne.addElement(new ConstantNode("d"), new ConstantNode('a\\b'));

    let arrTwo = createArrayNode();
    arrTwo.addElement(new ConstantNode('c'));
    arrTwo.addElement(new ConstantNode('d'));
    return [
        ['{"0": "b", "b": "a"}', getArrayNode()],
        ['{"a\\"b": "c", "a\\\\b": "d"}', arrOne],
        ['["c", "d"]', arrTwo]
    ];
}

function getArrayNode() {
    let arr = createArrayNode();
    arr.addElement(new ConstantNode("a"), new ConstantNode("b"));
    arr.addElement(new ConstantNode("b"), new ConstantNode("0"));
    return arr;
}

function createArrayNode() {
    return new ArrayNode();
}

test('evaluate ArrayNode', () => {
    for (let evaluateParams of getEvaluateData()) {
        //console.log("Evaluating: ", evaluateParams);
        let evaluated = evaluateParams[1].evaluate({}, {});
        //console.log("Evaluated: ", evaluated);
        if (evaluateParams[0] !== null && typeof evaluateParams[0] === "object") {
            expect(evaluated).toMatchObject(evaluateParams[0]);
        }
        else {
            expect(evaluated).toBe(evaluateParams[0]);
        }
    }
});

test('compile ArrayNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump ArrayNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});