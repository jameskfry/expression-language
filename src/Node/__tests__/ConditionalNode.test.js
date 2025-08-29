import ConditionalNode from "../ConditionalNode";
import ConstantNode from "../ConstantNode";
import Compiler from "../../Compiler";

function getEvaluateData()
{
    return [
        [1, new ConditionalNode(new ConstantNode(true), new ConstantNode(1), new ConstantNode(2))],
        [2, new ConditionalNode(new ConstantNode(false), new ConstantNode(1), new ConstantNode(2))],
        // Shorthand: condition ? 'yes' => condition ? 'yes' : ''
        ['yes', new ConditionalNode(new ConstantNode(true), new ConstantNode('yes'), new ConstantNode(''))],
        ['', new ConditionalNode(new ConstantNode(false), new ConstantNode('yes'), new ConstantNode(''))],
        // Elvis-like: a ? b => a ? a : b
        ['left', new ConditionalNode(new ConstantNode('left'), new ConstantNode('left'), new ConstantNode('right'))],
        ['right', new ConditionalNode(new ConstantNode(false), new ConstantNode(false), new ConstantNode('right'))],
    ];
}

function getCompileData()
{
    return [
        ['((true) ? (1) : (2))', new ConditionalNode(new ConstantNode(true), new ConstantNode(1), new ConstantNode(2))],
        ['((false) ? (1) : (2))', new ConditionalNode(new ConstantNode(false), new ConstantNode(1), new ConstantNode(2))],
        ['((true) ? ("yes") : (""))', new ConditionalNode(new ConstantNode(true), new ConstantNode('yes'), new ConstantNode(''))],
        ['((false) ? ("yes") : (""))', new ConditionalNode(new ConstantNode(false), new ConstantNode('yes'), new ConstantNode(''))],
        ['(("left") ? ("left") : ("right"))', new ConditionalNode(new ConstantNode('left'), new ConstantNode('left'), new ConstantNode('right'))],
        ['((false) ? (false) : ("right"))', new ConditionalNode(new ConstantNode(false), new ConstantNode(false), new ConstantNode('right'))],
    ];
}

function getDumpData()
{
    return [
        ['(true ? 1 : 2)', new ConditionalNode(new ConstantNode(true), new ConstantNode(1), new ConstantNode(2))],
        ['(false ? 1 : 2)', new ConditionalNode(new ConstantNode(false), new ConstantNode(1), new ConstantNode(2))],
        ['(true ? "yes" : "")', new ConditionalNode(new ConstantNode(true), new ConstantNode('yes'), new ConstantNode(''))],
        ['(false ? "yes" : "")', new ConditionalNode(new ConstantNode(false), new ConstantNode('yes'), new ConstantNode(''))],
        ['("left" ? "left" : "right")', new ConditionalNode(new ConstantNode('left'), new ConstantNode('left'), new ConstantNode('right'))],
        ['(false ? false : "right")', new ConditionalNode(new ConstantNode(false), new ConstantNode(false), new ConstantNode('right'))],
    ];
}

test('evaluate ConditionalNode', () => {
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

test('compile ConditionalNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump ConditionalNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});