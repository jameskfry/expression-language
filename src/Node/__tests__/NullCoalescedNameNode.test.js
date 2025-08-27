import NullCoalescedNameNode from "../NullCoalescedNameNode";
import Compiler from "../../Compiler";

function getEvaluateData() {
    return [
        [null, new NullCoalescedNameNode('foo'), {}]
    ];
}

function getCompileData() {
    return [
        ['foo ?? null', new NullCoalescedNameNode('foo')],
    ];
}

function getDumpData() {
    return [
        ['foo ?? null', new NullCoalescedNameNode('foo')],
    ]
}

test('evaluate NullCoalescedNameNode', () => {
    for (let evaluateParams of getEvaluateData()) {
        let evaluated = evaluateParams[1].evaluate({}, evaluateParams[2]);
        if (evaluateParams[0] !== null && typeof evaluateParams[0] === "object") {
            expect(evaluated).toMatchObject(evaluateParams[0]);
        }
        else {
            expect(evaluated).toBe(evaluateParams[0]);
        }
    }
});

test('compile NullCoalescedNameNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump NullCoalescedNameNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});