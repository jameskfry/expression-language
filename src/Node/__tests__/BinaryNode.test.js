import ConstantNode from "../ConstantNode";
import ArrayNode from "../ArrayNode";
import BinaryNode from "../BinaryNode";
import NameNode from "../NameNode";
import Compiler from "../../Compiler";
import DivisionByZeroError from "../../DivisionByZeroError";
import CompileRuntime from "../../CompileRuntime";
import PortabilityError from "../../Semantics/PortabilityError";
import SyntaxError from "../../SyntaxError";

function getEvaluateData()
{
    let arr = new ArrayNode();
    arr.addElement(new ConstantNode('a'));
    arr.addElement(new ConstantNode('b'));

    return [
        [true, new BinaryNode('or', new ConstantNode(true), new ConstantNode(false))],
        [true, new BinaryNode('||', new ConstantNode(true), new ConstantNode(false))],
        // Left operand falsy: the right operand must actually be evaluated (no short-circuit).
        [true, new BinaryNode('or', new ConstantNode(false), new ConstantNode(true))],
        [false, new BinaryNode('xor', new ConstantNode(true), new ConstantNode(true))],
        [false, new BinaryNode('and', new ConstantNode(true), new ConstantNode(false))],
        [false, new BinaryNode('&&', new ConstantNode(true), new ConstantNode(false))],

        [0, new BinaryNode('&', new ConstantNode(2), new ConstantNode(4))],
        [6, new BinaryNode('|', new ConstantNode(2), new ConstantNode(4))],
        [6, new BinaryNode('^', new ConstantNode(2), new ConstantNode(4))],
        [32, new BinaryNode('<<', new ConstantNode(2), new ConstantNode(4))],
        [2, new BinaryNode('>>', new ConstantNode(32), new ConstantNode(4))],

        [true, new BinaryNode('<', new ConstantNode(1), new ConstantNode(2))],
        [true, new BinaryNode('<=', new ConstantNode(1), new ConstantNode(2))],
        [true, new BinaryNode('<=', new ConstantNode(1), new ConstantNode(1))],

        [false, new BinaryNode('>', new ConstantNode(1), new ConstantNode(2))],
        [false, new BinaryNode('>=', new ConstantNode(1), new ConstantNode(2))],
        [true, new BinaryNode('>=', new ConstantNode(1), new ConstantNode(1))],

        [true, new BinaryNode('===', new ConstantNode(true), new ConstantNode(true))],
        [false, new BinaryNode('!==', new ConstantNode(true), new ConstantNode(true))],

        [false, new BinaryNode('==', new ConstantNode(2), new ConstantNode(1))],
        [true, new BinaryNode('!=', new ConstantNode(2), new ConstantNode(1))],

        [-1, new BinaryNode('-', new ConstantNode(1), new ConstantNode(2))],
        [3, new BinaryNode('+', new ConstantNode(1), new ConstantNode(2))],
        [4, new BinaryNode('*', new ConstantNode(2), new ConstantNode(2))],
        [1, new BinaryNode('/', new ConstantNode(2), new ConstantNode(2))],
        [1, new BinaryNode('%', new ConstantNode(5), new ConstantNode(2))],
        [25, new BinaryNode('**', new ConstantNode(5), new ConstantNode(2))],
        ['ab', new BinaryNode('~', new ConstantNode('a'), new ConstantNode('b'))],

        [true, new BinaryNode('in', new ConstantNode('a'), arr)],
        [false, new BinaryNode('in', new ConstantNode('c'), arr)],
        [true, new BinaryNode('not in', new ConstantNode('c'), arr)],
        [false, new BinaryNode('not in', new ConstantNode('a'), arr)],

        [[1, 2, 3], new BinaryNode('..', new ConstantNode(1), new ConstantNode(3))],

        [true, new BinaryNode('starts with', new ConstantNode('abc'), new ConstantNode('a'))],
        [false, new BinaryNode('starts with', new ConstantNode('abc'), new ConstantNode('b'))],
        [true, new BinaryNode('ends with', new ConstantNode('abc'), new ConstantNode('c'))],
        [false, new BinaryNode('ends with', new ConstantNode('abc'), new ConstantNode('b'))],

        [true, new BinaryNode('matches', new ConstantNode('abc'), new ConstantNode('/^[a-z]+$/'))],
        [false, new BinaryNode('matches', new ConstantNode(''), new ConstantNode('/^[a-z]+$/'))],
        // null is an empty string, like PHP's (string) cast
        [false, new BinaryNode('matches', new ConstantNode(null), new ConstantNode('/^[a-z]+$/'))],
        [true, new BinaryNode('matches', new ConstantNode(null), new ConstantNode('/^$/'))],

        // case-sensitive by default, like PHP's str_contains() & co.
        [true, new BinaryNode('contains', new ConstantNode('abcd'), new ConstantNode('bc'))],
        [false, new BinaryNode('contains', new ConstantNode('abcd'), new ConstantNode('BC'))],
        [false, new BinaryNode('starts with', new ConstantNode('abcd'), new ConstantNode('AB'))],
        [false, new BinaryNode('ends with', new ConstantNode('abcd'), new ConstantNode('CD'))],

        // ...unless asked to ignore case
        [true, new BinaryNode('contains', new ConstantNode('abcd'), new ConstantNode('BC'), true)],
        [true, new BinaryNode('starts with', new ConstantNode('abcd'), new ConstantNode('AB'), true)],
        [true, new BinaryNode('ends with', new ConstantNode('abcd'), new ConstantNode('CD'), true)],
        [false, new BinaryNode('ends with', new ConstantNode('abcd'), new ConstantNode('AB'), true)],

        // logical operators yield booleans, never one of their operands
        [true, new BinaryNode('or', new ConstantNode(0), new ConstantNode(5))],
        [true, new BinaryNode('and', new ConstantNode('a'), new ConstantNode('b'))],
        [false, new BinaryNode('and', new ConstantNode('a'), new ConstantNode(0))],
        [false, new BinaryNode('or', new ConstantNode(null), new ConstantNode(0))],
        [true, new BinaryNode('xor', new ConstantNode(1), new ConstantNode(0))],

        // null is an empty string when concatenating
        ['a', new BinaryNode('~', new ConstantNode('a'), new ConstantNode(null))],

        // `in` searches the values of a hash too
        [true, new BinaryNode('in', new ConstantNode(1), (() => { let h = new ArrayNode(); h.addElement(new ConstantNode(1), new ConstantNode('k')); return h; })())],
    ];
}

function getCompileData()
{
    let arr = new ArrayNode();
    arr.addElement(new ConstantNode('a'));
    arr.addElement(new ConstantNode('b'));

    return [
        ['(!!(true || false))', new BinaryNode('or', new ConstantNode(true), new ConstantNode(false), false, 'js')],
        ['(!!(true || false))', new BinaryNode('||', new ConstantNode(true), new ConstantNode(false), false, 'js')],
        ['(!(true) !== !(true))', new BinaryNode('xor', new ConstantNode(true), new ConstantNode(true), false, 'js')],
        ['(!!(true && false))', new BinaryNode('and', new ConstantNode(true), new ConstantNode(false), false, 'js')],
        ['(!!(true && false))', new BinaryNode('&&', new ConstantNode(true), new ConstantNode(false), false, 'js')],

        ['(2 & 4)', new BinaryNode('&', new ConstantNode(2), new ConstantNode(4), false, 'js')],
        ['(2 | 4)', new BinaryNode('|', new ConstantNode(2), new ConstantNode(4), false, 'js')],
        ['(2 ^ 4)', new BinaryNode('^', new ConstantNode(2), new ConstantNode(4), false, 'js')],
        ['(2 << 4)', new BinaryNode('<<', new ConstantNode(2), new ConstantNode(4), false, 'js')],
        ['(32 >> 4)', new BinaryNode('>>', new ConstantNode(32), new ConstantNode(4), false, 'js')],

        ['(1 < 2)', new BinaryNode('<', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(1 <= 2)', new BinaryNode('<=', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(1 <= 1)', new BinaryNode('<=', new ConstantNode(1), new ConstantNode(1), false, 'js')],

        ['(1 > 2)', new BinaryNode('>', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(1 >= 2)', new BinaryNode('>=', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(1 >= 1)', new BinaryNode('>=', new ConstantNode(1), new ConstantNode(1), false, 'js')],

        ['(true === true)', new BinaryNode('===', new ConstantNode(true), new ConstantNode(true), false, 'js')],
        ['(true !== true)', new BinaryNode('!==', new ConstantNode(true), new ConstantNode(true), false, 'js')],

        ['(2 == 1)', new BinaryNode('==', new ConstantNode(2), new ConstantNode(1), false, 'js')],
        ['(2 != 1)', new BinaryNode('!=', new ConstantNode(2), new ConstantNode(1), false, 'js')],

        ['(1 - 2)', new BinaryNode('-', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(1 + 2)', new BinaryNode('+', new ConstantNode(1), new ConstantNode(2), false, 'js')],
        ['(2 * 2)', new BinaryNode('*', new ConstantNode(2), new ConstantNode(2), false, 'js')],
        ['(function(__l, __r){if(__r===null||__r===undefined||0==__r){var __e=new Error("Division by zero.");__e.name="DivisionByZeroError";throw __e;}return __l / __r;})(2, 2)', new BinaryNode('/', new ConstantNode(2), new ConstantNode(2), false, 'js')],
        ['(function(__l, __r){if(__r===null||__r===undefined||0==__r){var __e=new Error("Modulo by zero.");__e.name="DivisionByZeroError";throw __e;}return __l % __r;})(5, 2)', new BinaryNode('%', new ConstantNode(5), new ConstantNode(2), false, 'js')],
        ['Math.pow(5, 2)', new BinaryNode('**', new ConstantNode(5), new ConstantNode(2), false, 'js')],
        ['(String("a" ?? "") + String("b" ?? ""))', new BinaryNode('~', new ConstantNode('a'), new ConstantNode('b'), false, 'js')],

        ['(function(__l, __r){if(!Array.isArray(__r)){if(__r!==null&&typeof __r==="object"){__r=Object.keys(__r).map(function(__k){return __r[__k];});}else{throw new TypeError("in_array(): Argument #2 ($haystack) must be of type array, "+(__r===null||__r===undefined?"null":typeof __r==="number"?(Number.isInteger(__r)?"int":"float"):typeof __r==="boolean"?"bool":typeof __r)+" given");}}return __r.indexOf(__l) >= 0;})("a", ["a", "b"])', new BinaryNode('in', new ConstantNode('a'), arr, false, 'js')],
        ['(function(__l, __r){if(!Array.isArray(__r)){if(__r!==null&&typeof __r==="object"){__r=Object.keys(__r).map(function(__k){return __r[__k];});}else{throw new TypeError("in_array(): Argument #2 ($haystack) must be of type array, "+(__r===null||__r===undefined?"null":typeof __r==="number"?(Number.isInteger(__r)?"int":"float"):typeof __r==="boolean"?"bool":typeof __r)+" given");}}return __r.indexOf(__l) >= 0;})("c", ["a", "b"])', new BinaryNode('in', new ConstantNode('c'), arr, false, 'js')],
        ['(function(__l, __r){if(!Array.isArray(__r)){if(__r!==null&&typeof __r==="object"){__r=Object.keys(__r).map(function(__k){return __r[__k];});}else{throw new TypeError("in_array(): Argument #2 ($haystack) must be of type array, "+(__r===null||__r===undefined?"null":typeof __r==="number"?(Number.isInteger(__r)?"int":"float"):typeof __r==="boolean"?"bool":typeof __r)+" given");}}return __r.indexOf(__l) === -1;})("c", ["a", "b"])', new BinaryNode('not in', new ConstantNode('c'), arr, false, 'js')],
        ['(function(__l, __r){if(!Array.isArray(__r)){if(__r!==null&&typeof __r==="object"){__r=Object.keys(__r).map(function(__k){return __r[__k];});}else{throw new TypeError("in_array(): Argument #2 ($haystack) must be of type array, "+(__r===null||__r===undefined?"null":typeof __r==="number"?(Number.isInteger(__r)?"int":"float"):typeof __r==="boolean"?"bool":typeof __r)+" given");}}return __r.indexOf(__l) === -1;})("a", ["a", "b"])', new BinaryNode('not in', new ConstantNode('a'), arr, false, 'js')],

        ['(function(__s, __e){var __r=[],__i;if(Math.abs(__e-__s)+1>10000000){var __x=new RangeError("The supplied range exceeds the maximum array size: start="+__s+", end="+__e);__x.name="ValueError";throw __x;}if(__s<=__e){for(__i=__s;__i<=__e;__i++){__r.push(__i);}}else{for(__i=__s;__i>=__e;__i--){__r.push(__i);}}return __r;})(1, 3)', new BinaryNode('..', new ConstantNode(1), new ConstantNode(3), false, 'js')],

        ['(new RegExp("^[a-z]+$", "i").test(String("abc" ?? "")))', new BinaryNode('matches', new ConstantNode('abc'), new ConstantNode('/^[a-z]+$/i', true), false, 'js')],

        ['(String("abc" ?? "").includes(String("B" ?? "")))', new BinaryNode('contains', new ConstantNode('abc'), new ConstantNode('B', false), false, 'js')],
        ['(String("abc" ?? "").startsWith(String("AB" ?? "")))', new BinaryNode('starts with', new ConstantNode('abc'), new ConstantNode('AB', false), false, 'js')],
        ['(String("abc" ?? "").endsWith(String("BC" ?? "")))', new BinaryNode('ends with', new ConstantNode('abc'), new ConstantNode('BC', false), false, 'js')],
        ['(String("abc" ?? "").toLowerCase().includes(String("B" ?? "").toLowerCase()))', new BinaryNode('contains', new ConstantNode('abc'), new ConstantNode('B', false), true, 'js')],
        ['(String("abc" ?? "").toLowerCase().startsWith(String("AB" ?? "").toLowerCase()))', new BinaryNode('starts with', new ConstantNode('abc'), new ConstantNode('AB', false), true, 'js')],
        ['(String("abc" ?? "").toLowerCase().endsWith(String("BC" ?? "").toLowerCase()))', new BinaryNode('ends with', new ConstantNode('abc'), new ConstantNode('BC', false), true, 'js')],
    ];
}

function getDumpData()
{
    let arr = new ArrayNode();
    arr.addElement(new ConstantNode('a'));
    arr.addElement(new ConstantNode('b'));

    return [
        ['(true or false)', new BinaryNode('or', new ConstantNode(true), new ConstantNode(false))],
        ['(true || false)', new BinaryNode('||', new ConstantNode(true), new ConstantNode(false))],
        ['(true xor true)', new BinaryNode('xor', new ConstantNode(true), new ConstantNode(true))],
        ['(true and false)', new BinaryNode('and', new ConstantNode(true), new ConstantNode(false))],
        ['(true && false)', new BinaryNode('&&', new ConstantNode(true), new ConstantNode(false))],

        ['(2 & 4)', new BinaryNode('&', new ConstantNode(2), new ConstantNode(4))],
        ['(2 | 4)', new BinaryNode('|', new ConstantNode(2), new ConstantNode(4))],
        ['(2 ^ 4)', new BinaryNode('^', new ConstantNode(2), new ConstantNode(4))],
        ['(2 << 4)', new BinaryNode('<<', new ConstantNode(2), new ConstantNode(4))],
        ['(32 >> 4)', new BinaryNode('>>', new ConstantNode(32), new ConstantNode(4))],

        ['(1 < 2)', new BinaryNode('<', new ConstantNode(1), new ConstantNode(2))],
        ['(1 <= 2)', new BinaryNode('<=', new ConstantNode(1), new ConstantNode(2))],
        ['(1 <= 1)', new BinaryNode('<=', new ConstantNode(1), new ConstantNode(1))],

        ['(1 > 2)', new BinaryNode('>', new ConstantNode(1), new ConstantNode(2))],
        ['(1 >= 2)', new BinaryNode('>=', new ConstantNode(1), new ConstantNode(2))],
        ['(1 >= 1)', new BinaryNode('>=', new ConstantNode(1), new ConstantNode(1))],

        ['(true === true)', new BinaryNode('===', new ConstantNode(true), new ConstantNode(true))],
        ['(true !== true)', new BinaryNode('!==', new ConstantNode(true), new ConstantNode(true))],

        ['(2 == 1)', new BinaryNode('==', new ConstantNode(2), new ConstantNode(1))],
        ['(2 != 1)', new BinaryNode('!=', new ConstantNode(2), new ConstantNode(1))],

        ['(1 - 2)', new BinaryNode('-', new ConstantNode(1), new ConstantNode(2))],
        ['(1 + 2)', new BinaryNode('+', new ConstantNode(1), new ConstantNode(2))],
        ['(2 * 2)', new BinaryNode('*', new ConstantNode(2), new ConstantNode(2))],
        ['(2 / 2)', new BinaryNode('/', new ConstantNode(2), new ConstantNode(2))],
        ['(5 % 2)', new BinaryNode('%', new ConstantNode(5), new ConstantNode(2))],
        ['(5 ** 2)', new BinaryNode('**', new ConstantNode(5), new ConstantNode(2))],
        ['("a" ~ "b")', new BinaryNode('~', new ConstantNode('a'), new ConstantNode('b'))],

        ['("a" in ["a", "b"])', new BinaryNode('in', new ConstantNode('a'), arr)],
        ['("c" in ["a", "b"])', new BinaryNode('in', new ConstantNode('c'), arr)],
        ['("c" not in ["a", "b"])', new BinaryNode('not in', new ConstantNode('c'), arr)],
        ['("a" not in ["a", "b"])', new BinaryNode('not in', new ConstantNode('a'), arr)],

        ['(1 .. 3)', new BinaryNode('..', new ConstantNode(1), new ConstantNode(3))],

        ['("abc" matches "/^[a-z]+/i$/")', new BinaryNode('matches', new ConstantNode('abc'), new ConstantNode('/^[a-z]+/i$/'))],

        ['("abc" contains "B")', new BinaryNode('contains', new ConstantNode('abc'), new ConstantNode('B'))],
        ['("abc" starts with "AB")', new BinaryNode('starts with', new ConstantNode('abc'), new ConstantNode('AB'))],
        ['("abc" ends with "BC")', new BinaryNode('ends with', new ConstantNode('abc'), new ConstantNode('BC'))],
    ];
}

test('evaluate BinaryNode', () => {
    let textIndex = 0;
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

        textIndex++;
    }
});

test('compile BinaryNode', () => {
    for (let compileParams of getCompileData()) {
        let compiler = new Compiler({});
        compileParams[1].compile(compiler);
        expect(compiler.getSource()).toBe(compileParams[0]);
    }
});

test('dump BinaryNode', () => {
    for (let dumpParams of getDumpData()) {
        expect(dumpParams[1].dump()).toBe(dumpParams[0]);
    }
});

// Runs the compiled code of a node, the way an application would: with the runtime in scope
function runCompiled(node, names = [], values = []) {
    let compiler = new Compiler({});
    node.compile(compiler);

    return new Function('__runtime', ...names, 'return ' + compiler.getSource() + ';')(CompileRuntime, ...values);
}

const SEMANTICS = ['symfony', 'js', 'portable'];

test('compile BinaryNode with the rules of Symfony (the default) calls the runtime', () => {
    const two = () => new ConstantNode(2);
    const three = () => new ConstantNode(3);

    for (const [expected, node] of [
        ['__runtime.symfony.add(2, 3)', new BinaryNode('+', two(), three())],
        ['__runtime.symfony.sub(2, 3)', new BinaryNode('-', two(), three())],
        ['__runtime.symfony.div(2, 3)', new BinaryNode('/', two(), three())],
        ['__runtime.symfony.pow(2, 3)', new BinaryNode('**', two(), three())],
        ['__runtime.symfony.shl(2, 3)', new BinaryNode('<<', two(), three())],
        ['__runtime.symfony.eq(2, 3)', new BinaryNode('==', two(), three())],
        ['__runtime.symfony.identical(2, 3)', new BinaryNode('===', two(), three())],
        ['__runtime.symfony.notIdentical(2, 3)', new BinaryNode('!==', two(), three())],
        ['__runtime.symfony.le(2, 3)', new BinaryNode('<=', two(), three())],
        ['__runtime.symfony.concat(2, 3)', new BinaryNode('~', two(), three())],
        ['__runtime.symfony.inArray(2, 3)', new BinaryNode('in', two(), three())],
        ['__runtime.symfony.notInArray(2, 3)', new BinaryNode('not in', two(), three())],
        ['__runtime.symfony.contains(2, 3)', new BinaryNode('contains', two(), three())],
        ['__runtime.symfony.startsWith(2, 3, true)', new BinaryNode('starts with', two(), three(), true)],
        ['(__runtime.symfony.truthy(2) && __runtime.symfony.truthy(3))', new BinaryNode('and', two(), three())],
        ['(__runtime.symfony.truthy(2) || __runtime.symfony.truthy(3))', new BinaryNode('||', two(), three())],
        ['(__runtime.symfony.truthy(2) !== __runtime.symfony.truthy(3))', new BinaryNode('xor', two(), three())],
        ['__runtime.portable.add(2, 3)', new BinaryNode('+', two(), three(), false, 'portable')],
        ['(__runtime.portable.truthy(2) && __runtime.portable.truthy(3))', new BinaryNode('&&', two(), three(), false, 'portable')],
    ]) {
        let compiler = new Compiler({});
        node.compile(compiler);
        expect(compiler.getSource()).toBe(expected);
    }
});

test('with the "js" rules, in, not in and .. compile to code that needs nothing (no undefined globals)', () => {
    for (let [operator, node] of [
        ['in', new BinaryNode('in', new ConstantNode('a'), (() => {
            let arr = new ArrayNode();
            arr.addElement(new ConstantNode('a'));
            arr.addElement(new ConstantNode('b'));
            return arr;
        })(), false, 'js')],
        ['not in', new BinaryNode('not in', new ConstantNode('c'), (() => {
            let arr = new ArrayNode();
            arr.addElement(new ConstantNode('a'));
            arr.addElement(new ConstantNode('b'));
            return arr;
        })(), false, 'js')],
        ['..', new BinaryNode('..', new ConstantNode(1), new ConstantNode(3), false, 'js')],
    ]) {
        let compiler = new Compiler({});
        node.compile(compiler);
        // eslint-disable-next-line no-eval
        expect(eval(compiler.getSource())).toEqual(node.evaluate({}, {}));
    }
});

test('".." counts down when the start is above the end, like PHP, whatever the rules', () => {
    for (const semantics of SEMANTICS) {
        let node = new BinaryNode('..', new ConstantNode(3), new ConstantNode(1), false, semantics);

        expect(node.evaluate({}, {})).toEqual([3, 2, 1]);
        expect(runCompiled(node)).toEqual([3, 2, 1]);
        expect(new BinaryNode('..', new ConstantNode(2), new ConstantNode(2), false, semantics).evaluate({}, {})).toEqual([2]);
    }
});

test('division and modulo by zero throw like PHP, evaluated and compiled, whatever the rules', () => {
    for (const semantics of SEMANTICS) {
        for (const [operator, message] of [['/', 'Division by zero.'], ['%', 'Modulo by zero.']]) {
            for (const zero of [0, '0', null, false]) {
                let node = new BinaryNode(operator, new ConstantNode(1), new ConstantNode(zero), false, semantics);
                expect(() => node.evaluate({}, {})).toThrow(message);
                expect(() => node.evaluate({}, {})).toThrow(DivisionByZeroError);

                let thrown = null;
                try {
                    runCompiled(node);
                } catch (e) {
                    thrown = e;
                }
                expect(thrown).not.toBeNull();
                expect(thrown.message).toBe(message);
                expect(thrown.name).toBe('DivisionByZeroError');
            }
        }
    }
});

test('"in" words its error with PHP\'s type names, evaluated and compiled, whatever the rules', () => {
    for (const semantics of SEMANTICS) {
        for (const [haystack, type] of [[5, 'int'], [1.5, 'float'], [true, 'bool'], ['abc', 'string'], [null, 'null']]) {
            let node = new BinaryNode('in', new ConstantNode('a'), new ConstantNode(haystack), false, semantics);

            expect(() => node.evaluate({}, {})).toThrow(`must be of type array, ${type} given`);
            expect(() => runCompiled(node)).toThrow(`must be of type array, ${type} given`);
        }
    }
});

test('"in" and "not in" refuse a right operand that is neither an array nor a hash, whatever the rules', () => {
    for (const semantics of SEMANTICS) {
        for (const operator of ['in', 'not in']) {
            for (const haystack of ['abc', 5, null]) {
                let node = new BinaryNode(operator, new ConstantNode('a'), new ConstantNode(haystack), false, semantics);
                expect(() => node.evaluate({}, {})).toThrow('in_array(): Argument #2 ($haystack) must be of type array');
                expect(() => runCompiled(node)).toThrow(TypeError);
            }
        }
    }
});

test('"matches" reports invalid patterns as a SyntaxError, evaluated and compiled', () => {
    for (const pattern of ['/(/', 'no delimiters', '', '/unterminated', '/a/z']) {
        let node = new BinaryNode('matches', new ConstantNode('a'), new ConstantNode(pattern));
        expect(() => node.evaluate({}, {})).toThrow(SyntaxError);
        expect(() => node.evaluate({}, {})).toThrow(`Regexp "${pattern}" passed to "matches" is not valid`);
        // a constant pattern is validated while compiling
        expect(() => node.compile(new Compiler({}))).toThrow(SyntaxError);
    }
});

test('"matches" requires a string pattern', () => {
    let node = new BinaryNode('matches', new ConstantNode('a'), new ConstantNode(5));
    expect(() => node.evaluate({}, {})).toThrow('The regex passed to "matches" must be a string');

    let nonConcatenation = new BinaryNode('matches', new ConstantNode('a'), new BinaryNode('+', new ConstantNode('/a'), new ConstantNode('/')));
    expect(() => nonConcatenation.compile(new Compiler({}))).toThrow('The regex passed to "matches" must be a string');
});

test('"matches" supports PCRE style delimiters and modifiers', () => {
    const run = (subject, pattern) => new BinaryNode('matches', new ConstantNode(subject), new ConstantNode(pattern)).evaluate({}, {});

    expect(run('ABC', '/abc/i')).toBe(true);
    expect(run('ABC', '#abc#i')).toBe(true);
    expect(run('ABC', '{abc}i')).toBe(true);
    expect(run('a/b', '#a/b#')).toBe(true);
    expect(run('a\nb', '/^b$/m')).toBe(true);
    expect(run('a\nb', '/a.b/s')).toBe(true);
    expect(run('a\nb', '/a.b/')).toBe(false);
});

test('"matches" compiled with a pattern only known at runtime behaves like evaluate, whatever the rules', () => {
    for (const semantics of SEMANTICS) {
        for (const [subject, pattern, expected] of [['abc', '/^a/', true], ['abc', '/^b/', false], ['ABC', '/^a/i', true], [null, '/^$/', true]]) {
            let node = new BinaryNode('matches', new NameNode('s'), new NameNode('p'), false, semantics);

            expect(node.evaluate({}, {s: subject, p: pattern})).toBe(expected);
            expect(runCompiled(node, ['s', 'p'], [subject, pattern])).toBe(expected);
        }

        let node = new BinaryNode('matches', new NameNode('s'), new NameNode('p'), false, semantics);
        expect(() => runCompiled(node, ['s', 'p'], ['a', '/(/'])).toThrow('is not valid');
    }
});

test('every operator gives the same result evaluated and compiled, whatever the rules', () => {
    const samples = [[2, 3], [5, 2], ['abc', 'B'], ['abc', 'b'], [null, 'x'], [0, 5], ['x', null], [true, false], ['5', 1], ['0', ''], [[1], [1]]];
    const operators = ['or', '||', 'and', '&&', 'xor', '|', '&', '^', '<<', '>>', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '~', 'contains', 'starts with', 'ends with', 'in', 'not in'];
    const outcome = (callback) => {
        try {
            return {value: callback()};
        } catch (e) {
            return {error: e.name};
        }
    };

    for (const semantics of SEMANTICS) {
        for (const operator of operators) {
            for (const [a, b] of samples) {
                for (const caseInsensitive of [false, true]) {
                    let node = new BinaryNode(operator, new NameNode('a'), new NameNode('b'), caseInsensitive, semantics);

                    const evaluated = outcome(() => node.evaluate({}, {a, b}));
                    const compiled = outcome(() => runCompiled(node, ['a', 'b'], [a, b]));

                    expect([semantics, operator, a, b, caseInsensitive, compiled]).toEqual([semantics, operator, a, b, caseInsensitive, evaluated]);
                }
            }
        }
    }
});

describe('the rules decide', () => {
    const run = (operator, left, right, semantics) => {
        try {
            return new BinaryNode(operator, new ConstantNode(left), new ConstantNode(right), false, semantics).evaluate({}, {});
        } catch (e) {
            return e.name;
        }
    };

    test('what + does with a string', () => {
        expect(run('+', '5', 1, 'symfony')).toBe(6);
        expect(run('+', '5', 1, 'js')).toBe('51');
        expect(run('+', 'a', 1, 'symfony')).toBe('TypeError');
        expect(run('+', 5, 1, 'portable')).toBe(6);
        expect(run('+', '5', 1, 'portable')).toBe('PortabilityError');
    });

    test('how values are compared', () => {
        expect(run('==', null, false, 'symfony')).toBe(true);
        expect(run('==', null, false, 'js')).toBe(false);
        expect(run('==', 0, '', 'symfony')).toBe(false);
        expect(run('==', 0, '', 'js')).toBe(true);
        expect(run('==', 'abc', 0, 'symfony')).toBe(false);
        expect(run('<', '10', '9', 'symfony')).toBe(false);
        expect(run('<', '10', '9', 'js')).toBe(true);
        expect(run('==', 1, 1, 'portable')).toBe(true);
        expect(run('==', 0, '', 'portable')).toBe('PortabilityError');
    });

    test('how arrays are identical', () => {
        expect(run('===', [1, 2], [1, 2], 'symfony')).toBe(true);
        expect(run('===', [1, 2], [1, 2], 'js')).toBe(false);
        expect(run('in', [1, 2], [[1, 2]], 'symfony')).toBe(true);
        expect(run('in', [1, 2], [[1, 2]], 'js')).toBe(false);
    });

    test('how wide the bitwise operators are', () => {
        expect(run('<<', 1, 40, 'symfony')).toBe(1099511627776);
        expect(run('<<', 1, 40, 'js')).toBe(256);
        expect(run('<<', 1, 3, 'portable')).toBe(8);
        expect(run('<<', 1, 40, 'portable')).toBe('PortabilityError');
        expect(run('<<', 1, -1, 'symfony')).toBe('ArithmeticError');
    });

    test('how a value is turned into a string', () => {
        expect(run('~', true, null, 'symfony')).toBe('1');
        expect(run('~', true, null, 'js')).toBe('true');
        expect(run('~', 0.1 + 0.2, '', 'symfony')).toBe('0.3');
        expect(run('~', 0.1 + 0.2, '', 'js')).toBe('0.30000000000000004');
        expect(run('contains', true, '1', 'symfony')).toBe(true);
        expect(run('contains', [], 'a', 'symfony')).toBe('TypeError');
        expect(run('matches', true, '/^1$/', 'symfony')).toBe(true);
    });

    test('what a PortabilityError says', () => {
        let error = null;
        try {
            new BinaryNode('+', new ConstantNode('5'), new ConstantNode(1), false, 'portable').evaluate({}, {});
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(PortabilityError);
        expect(error.message).toBe('"+" is not portable: with "5" and 1, PHP gives 6 and JavaScript gives "51".');
        expect(error.operator).toBe('+');
        expect(error.operands).toEqual(['5', 1]);
        expect(error.symfony).toEqual({value: 6});
        expect(error.javascript).toEqual({value: '51'});
    });
});

test('the subject of "matches" is a string for PHP: scalars and null are converted, an array is refused', () => {
    const run = (subject, semantics) => {
        try {
            return new BinaryNode('matches', new ConstantNode(subject), new ConstantNode('/^1$/'), false, semantics).evaluate({}, {});
        } catch (e) {
            return e.name;
        }
    };

    expect(run(1, 'symfony')).toBe(true);
    expect(run(true, 'symfony')).toBe(true);
    expect(run(true, 'js')).toBe(false);
    expect(run(null, 'symfony')).toBe(false);
    expect(run([1], 'symfony')).toBe('TypeError');
    expect(run({a: 1}, 'portable')).toBe('PortabilityError');
    expect(run([1], 'js')).toBe(true); // String([1]) is "1"
    expect(() => new BinaryNode('matches', new ConstantNode([1]), new ConstantNode('/1/')).evaluate({}, {}))
        .toThrow('evaluateMatches(): Argument #2 ($str) must be of type ?string, array given');
    expect(() => runCompiled(new BinaryNode('matches', new ConstantNode([1]), new ConstantNode('/1/')))).toThrow('must be of type ?string, array given');
});

describe('the range operator ".."', () => {
    const range = (left, right, semantics) => {
        try {
            return new BinaryNode('..', new ConstantNode(left), new ConstantNode(right), false, semantics).evaluate({}, {});
        } catch (e) {
            return e.name;
        }
    };

    test('follows PHP by default: numeric strings are numbers, characters are ranged', () => {
        expect(range('1', '3', 'symfony')).toEqual([1, 2, 3]);
        expect(range('1', 3, 'symfony')).toEqual([1, 2, 3]);
        expect(range(1, '3', 'symfony')).toEqual([1, 2, 3]);
        expect(range('3', '1', 'symfony')).toEqual([3, 2, 1]);
        expect(range(' 2', 4, 'symfony')).toEqual([2, 3, 4]);
        expect(range('2x', 4, 'symfony')).toEqual([2, 3, 4]);
        expect(range(true, null, 'symfony')).toEqual([1, 0]);
        expect(range(1.5, 4, 'symfony')).toEqual([1.5, 2.5, 3.5]);
        expect(range('a', 'e', 'symfony')).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(range('e', 'c', 'symfony')).toEqual(['e', 'd', 'c']);
        expect(range('a', 'a', 'symfony')).toEqual(['a']);
        expect(range('ab', 'cd', 'symfony')).toEqual(['a', 'b', 'c']);
        expect(range('abc', 3, 'symfony')).toEqual([0, 1, 2, 3]);
    });

    test('keeps JavaScript\'s loop with the "js" rules', () => {
        expect(range('1', 3, 'js')).toEqual(['1', 2, 3]);
        expect(range(3, 1, 'js')).toEqual([3, 2, 1]);
    });

    test('is portable only when both agree', () => {
        expect(range(1, 3, 'portable')).toEqual([1, 2, 3]);
        expect(range('1', 3, 'portable')).toBe('PortabilityError');
        expect(range('a', 'c', 'portable')).toBe('PortabilityError');
    });

    test('refuses an array', () => {
        expect(range([1], 3, 'symfony')).toBe('TypeError');
        expect(() => new BinaryNode('..', new ConstantNode({}), new ConstantNode(3)).evaluate({}, {})).toThrow('range(): Argument #1 ($start) must be of type string|int|float, array given');
    });

    test('refuses a range that is too large to be an array, whatever the rules', () => {
        for (const semantics of SEMANTICS) {
            expect(range(0, 1e12, semantics)).toBe('ValueError');
            expect(range(1e12, 0, semantics)).toBe('ValueError');
        }
        expect(() => new BinaryNode('..', new ConstantNode(0), new ConstantNode(1e12)).evaluate({}, {})).toThrow('The supplied range exceeds the maximum array size: start=0, end=1000000000000');
        expect(range(0, 1000, 'symfony')).toHaveLength(1001);

        // the code compiled for the "js" rules, which needs nothing, has the same ceiling
        for (const semantics of SEMANTICS) {
            const node = new BinaryNode('..', new NameNode('a'), new NameNode('b'), false, semantics);
            expect(() => runCompiled(node, ['a', 'b'], [0, 1e12])).toThrow('The supplied range exceeds the maximum array size: start=0, end=1000000000000');
        }
    });

    test('is compiled like it is evaluated', () => {
        for (const semantics of ['symfony', 'js', 'portable']) {
            for (const [left, right] of [[1, 3], [3, 1], [2, 2], [-2, 2]]) {
                const node = new BinaryNode('..', new NameNode('a'), new NameNode('b'), false, semantics);

                expect(runCompiled(node, ['a', 'b'], [left, right])).toEqual(node.evaluate({}, {a: left, b: right}));
            }
        }
        expect(runCompiled(new BinaryNode('..', new NameNode('a'), new NameNode('b')), ['a', 'b'], ['1', '3'])).toEqual([1, 2, 3]);
        expect(runCompiled(new BinaryNode('..', new NameNode('a'), new NameNode('b')), ['a', 'b'], ['a', 'c'])).toEqual(['a', 'b', 'c']);
    });
});
