import ExpressionLanguage from "../../ExpressionLanguage";
import StringProvider from "../StringProvider";
import compileRuntime from "../../CompileRuntime";

test('strtolower evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strtolower("TESTING")');
    expect(result).toBe("testing");
});

test('strtolower compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strtolower("TESTING")');
    expect(result).toBe('__runtime.strtolower("TESTING")');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe("testing");
});

test('strtoupper evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strtoupper("testing")');
    expect(result).toBe("TESTING");
});

test('strtoupper compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strtoupper("testing")');
    expect(result).toBe('__runtime.strtoupper("testing")');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe("TESTING");
});

test('explode evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('explode(" ", "check this out")');
    expect(result).toMatchObject(["check", "this", "out"]);
});

test('explode evaluate with complex string', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('explode(" .*&3 ", "check .*&3 this .*&3 out")');
    expect(result).toMatchObject(["check", "this", "out"]);

    let result2 = el.evaluate('explode(" .*&3 ", "check  .*&3  this  .*&3  out")');
    expect(result2).toMatchObject(["check ", " this ", " out"]);
});

test('explode compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('explode(". ", "check this out")');
    expect(result).toBe('__runtime.explode(". ", "check this out", null)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toMatchObject(["check this out"]);
});

test('strlen evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strlen("Hats are cool")');
    expect(result).toBe(13);
});

test('strlen compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    // Regression check: this used to compile to `strlen(a);` — a bare,
    // undefined function call with a stray semicolon that broke compound
    // expressions like `strlen(a) + 1`.
    let result = el.compile('strlen(a) + 1', ['a']);
    expect(result).toBe('(__runtime.strlen(a) + 1)');

    let fn = new Function('__runtime', 'a', 'return ' + result + ';');
    expect(fn(compileRuntime, "Hats are cool")).toBe(14);
});

test('substr evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('substr("Hats are cool", 0, 3)');
    expect(result).toBe('Hat');
});

test('substr compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('substr("Hats are cool", 0, 3)');
    expect(result).toBe('__runtime.substr("Hats are cool", 0, 3)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('Hat');
});

test('stristr evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('stristr("Hats are cool", "Are")');
    expect(result).toBe('are cool');
});

test('stristr compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('stristr("Hats are cool", "Are")');
    expect(result).toBe('__runtime.stristr("Hats are cool", "Are")');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('are cool');
});

test('strstr evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strstr("Hats are cool", "are")');
    expect(result).toBe('are cool');

    let result2 = el.evaluate('strstr("Hats are cool", "Are")');
    expect(result2).toBe(false);
});

test('strstr evaluate with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strstr("Hats are cool", "are", true)');
    expect(result).toBe('Hats ');
});

test('strstr compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strstr("Hats are cool", "are")');
    expect(result).toBe('__runtime.strstr("Hats are cool", "are")');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('are cool');
});

test('strstr compile with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strstr("Hats are cool", "are", true)');
    expect(result).toBe('__runtime.strstr("Hats are cool", "are", true)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('Hats ');
});

test('stristr evaluate with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('stristr("Hats are cool", "Are", true)');
    expect(result).toBe('Hats ');
});

test('stristr compile with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('stristr("Hats are cool", "Are", true)');
    expect(result).toBe('__runtime.stristr("Hats are cool", "Are", true)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('Hats ');
});

test('substr evaluate without length', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('substr("Hats are cool", 5)');
    expect(result).toBe('are cool');
});

test('substr compile without length', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('substr("Hats are cool", 5)');
    expect(result).toBe('__runtime.substr("Hats are cool", 5)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe('are cool');
});
