import ConstantNode from "../ConstantNode";
import UnaryNode from "../UnaryNode";
import Compiler from "../../Compiler";

function getEvaluateData()
{
    return [
        [-1, new UnaryNode('-', new ConstantNode(1))],
        [3, new UnaryNode('+', new ConstantNode(3))],
        [false, new UnaryNode('!', new ConstantNode(true))],
        [false, new UnaryNode('not', new ConstantNode(true))],
    ];
}
function getCompileData()
{
    return [
        ['(-1)', new UnaryNode('-', new ConstantNode(1))],
        ['(+3)', new UnaryNode('+', new ConstantNode(3))],
        ['(!true)', new UnaryNode('!', new ConstantNode(true))],
        ['(!true)', new UnaryNode('not', new ConstantNode(true))],
    ];
}
function getDumpData()
{
    return [
        ['(- 1)', new UnaryNode('-', new ConstantNode(1))],
        ['(+ 3)', new UnaryNode('+', new ConstantNode(3))],
        ['(! true)', new UnaryNode('!', new ConstantNode(true))],
        ['(not true)', new UnaryNode('not', new ConstantNode(true))],
    ];
}
test('evaluate UnaryNode', () => {
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

test('compile UnaryNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump UnaryNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});