import ArgumentsNode from "../ArgumentsNode";
import ConstantNode from "../ConstantNode";
import Compiler from "../../Compiler";

function getCompileData() {
    return [
        ['"a", "b"', getArrayNode()]
    ]
}

function getDumpData() {
    return [
        ['"a", "b"', getArrayNode()]
    ]
}

function getArrayNode() {
    let arr = createArrayNode();
    arr.addElement(new ConstantNode("a"));
    arr.addElement(new ConstantNode("b"));
    return arr;
}

function createArrayNode() {
    return new ArgumentsNode();
}

test('compile ArgumentsNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump ArgumentsNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});

