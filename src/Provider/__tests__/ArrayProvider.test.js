import ExpressionLanguage from "../../ExpressionLanguage";
import ArrayProvider from "../ArrayProvider";
import compileRuntime from "../../CompileRuntime";

test('implode evaluate', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.evaluate('implode(". ", ["check", "this", "out"])');
    expect(result).toBe("check. this. out");
});

test('implode compile', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.compile('implode(". ", ["check", "this", "out"])');
    expect(result).toBe('__runtime.implode(". ", ["check", "this", "out"])');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe("check. this. out");
});

test('count evaluate', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.evaluate('count(["1", "2", "3"])');
    expect(result).toBe(3);

    let result2 = el.evaluate('count(["1", "2", "3", ["4", "5"]], "COUNT_RECURSIVE")');
    expect(result2).toBe(6); // Counts array as one, then contents individually
});

test('count compile', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.compile('count(["1", "2", "3"])');
    expect(result).toBe('__runtime.count(["1", "2", "3"])');

    let result2 = el.compile('count(["1", "2", "3"], "COUNT_RECURSIVE")');
    expect(result2).toBe('__runtime.count(["1", "2", "3"], "COUNT_RECURSIVE")');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe(3);
});

test('array_intersect evaluate', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.evaluate('array_intersect(["1", "2", "3"], ["1", "2", "3"], ["2", "3"])');
    expect(result).toMatchObject(["2", "3"]);
});

test('array_intersect compile', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.compile('array_intersect(["1", "2", "3"], ["1", "2", "3"], ["2", "3"])');
    expect(result).toBe('__runtime.array_intersect(["1", "2", "3"], ["1", "2", "3"], ["2", "3"])');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toMatchObject(["2", "3"]);
});

test('array_intersect compile with a single array argument (no additional args)', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.compile('array_intersect(["1", "2", "3"])');
    expect(result).toBe('__runtime.array_intersect(["1", "2", "3"])');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toMatchObject([]);
});

test('array_intersect evaluate with associative-object (non-array) arguments preserves keys', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.evaluate('array_intersect({a: "1", b: "2", c: "3"}, {x: "2", y: "3"})');
    expect(result).toEqual({b: "2", c: "3"});
});
