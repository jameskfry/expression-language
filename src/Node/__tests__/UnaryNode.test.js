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
        [-6, new UnaryNode('~', new ConstantNode(5))],
    ];
}
function getCompileData()
{
    return [
        ['(-1)', new UnaryNode('-', new ConstantNode(1), 'js')],
        ['(+3)', new UnaryNode('+', new ConstantNode(3), 'js')],
        ['(!true)', new UnaryNode('!', new ConstantNode(true), 'js')],
        ['(!true)', new UnaryNode('not', new ConstantNode(true), 'js')],
        ['(~5)', new UnaryNode('~', new ConstantNode(5), 'js')],
    ];
}
function getDumpData()
{
    return [
        ['(- 1)', new UnaryNode('-', new ConstantNode(1))],
        ['(+ 3)', new UnaryNode('+', new ConstantNode(3))],
        ['(! true)', new UnaryNode('!', new ConstantNode(true))],
        ['(not true)', new UnaryNode('not', new ConstantNode(true))],
        ['(~ 5)', new UnaryNode('~', new ConstantNode(5))],
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
test('compile UnaryNode with the rules of Symfony (the default) calls the runtime', () => {
    for (const [expected, node] of [
        ['__runtime.symfony.neg(1)', new UnaryNode('-', new ConstantNode(1))],
        ['(3)', new UnaryNode('+', new ConstantNode(3))],
        ['(!__runtime.symfony.truthy(true))', new UnaryNode('!', new ConstantNode(true))],
        ['(!__runtime.symfony.truthy(true))', new UnaryNode('not', new ConstantNode(true))],
        ['__runtime.symfony.bitNot(5)', new UnaryNode('~', new ConstantNode(5))],
        ['__runtime.portable.neg(1)', new UnaryNode('-', new ConstantNode(1), 'portable')],
        ['(!__runtime.portable.truthy(1))', new UnaryNode('!', new ConstantNode(1), 'portable')],
    ]) {
        let compiler = new Compiler({});
        node.compile(compiler);
        expect(compiler.getSource()).toBe(expected);
    }
});

test('the rules decide how a value is negated, inverted or tested', () => {
    const run = (operator, value, semantics) => {
        try {
            return new UnaryNode(operator, new ConstantNode(value), semantics).evaluate({}, {});
        } catch (e) {
            return e.name;
        }
    };

    expect(run('!', '0', 'symfony')).toBe(true);
    expect(run('!', '0', 'js')).toBe(false);
    expect(run('!', [], 'symfony')).toBe(true);
    expect(run('!', 'a', 'symfony')).toBe(false);
    expect(run('-', '5', 'symfony')).toBe(-5);
    expect(run('-', 'abc', 'symfony')).toBe('TypeError');
    expect(run('-', 'abc', 'js')).toBeNaN();
    expect(run('~', null, 'symfony')).toBe('TypeError');
    expect(run('~', null, 'js')).toBe(-1);
    // "portable": only what both agree on
    expect(run('!', 'a', 'portable')).toBe(false);
    expect(run('!', '0', 'portable')).toBe('PortabilityError');
    expect(run('-', 5, 'portable')).toBe(-5);
    // PHP refuses what JavaScript turns into NaN: not the same result
    expect(run('-', 'abc', 'portable')).toBe('PortabilityError');
});
