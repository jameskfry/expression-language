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
        ['((true) ? (1) : (2))', new ConditionalNode(new ConstantNode(true), new ConstantNode(1), new ConstantNode(2), 'js')],
        ['((false) ? (1) : (2))', new ConditionalNode(new ConstantNode(false), new ConstantNode(1), new ConstantNode(2), 'js')],
        ['((true) ? ("yes") : (""))', new ConditionalNode(new ConstantNode(true), new ConstantNode('yes'), new ConstantNode(''), 'js')],
        ['((false) ? ("yes") : (""))', new ConditionalNode(new ConstantNode(false), new ConstantNode('yes'), new ConstantNode(''), 'js')],
        ['(("left") ? ("left") : ("right"))', new ConditionalNode(new ConstantNode('left'), new ConstantNode('left'), new ConstantNode('right'), 'js')],
        ['((false) ? (false) : ("right"))', new ConditionalNode(new ConstantNode(false), new ConstantNode(false), new ConstantNode('right'), 'js')],
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
test('compile ConditionalNode with the rules of Symfony (the default) tests the condition through the runtime', () => {
    for (const [expected, node] of [
        ['(__runtime.symfony.truthy(true) ? (1) : (2))', new ConditionalNode(new ConstantNode(true), new ConstantNode(1), new ConstantNode(2))],
        ['(__runtime.portable.truthy("a") ? (1) : (2))', new ConditionalNode(new ConstantNode('a'), new ConstantNode(1), new ConstantNode(2), 'portable')],
    ]) {
        let compiler = new Compiler({});
        node.compile(compiler);
        expect(compiler.getSource()).toBe(expected);
    }
});

test('the rules decide whether the condition is true', () => {
    const run = (condition, semantics) => new ConditionalNode(new ConstantNode(condition), new ConstantNode('yes'), new ConstantNode('no'), semantics).evaluate({}, {});

    expect(run('0', 'symfony')).toBe('no');
    expect(run('0', 'js')).toBe('yes');
    expect(run([], 'symfony')).toBe('no');
    expect(run([], 'js')).toBe('yes');
    expect(run(Number.NaN, 'symfony')).toBe('yes');
    expect(run(Number.NaN, 'js')).toBe('no');
    expect(run('a', 'portable')).toBe('yes');
    expect(() => run('0', 'portable')).toThrow('not portable');
});
