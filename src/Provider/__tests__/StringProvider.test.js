import ExpressionLanguage from "../../ExpressionLanguage";
import StringProvider from "../StringProvider";

test('strtolower evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strtolower("TESTING")');
    expect(result).toBe("testing");
});

test('strtolower compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strtolower("TESTING")');
    expect(result).toBe('strtolower("TESTING")');
});

test('strtoupper evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strtoupper("testing")');
    expect(result).toBe("TESTING");
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
    expect(result).toBe('explode(". ", "check this out", null)');
});

test('strlen evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('strlen("Hats are cool")');
    expect(result).toBe(13);
});

test('substr evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('substr("Hats are cool", 0, 3)');
    expect(result).toBe('Hat');
});

test('stristr evaluate', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('stristr("Hats are cool", "Are")');
    expect(result).toBe('are cool');
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
    expect(result).toBe('strstr("Hats are cool", "are");');
});

test('strstr compile with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strstr("Hats are cool", "are", true)');
    expect(result).toBe('strstr("Hats are cool", "are", true);');
});

test('stristr compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('stristr("Hats are cool", "Are")');
    expect(result).toBe('stristr("Hats are cool", "Are");');
});

test('stristr evaluate with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('stristr("Hats are cool", "Are", true)');
    expect(result).toBe('Hats ');
});

test('stristr compile with before_needle', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('stristr("Hats are cool", "Are", true)');
    expect(result).toBe('stristr("Hats are cool", "Are", true);');
});

test('strtoupper compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strtoupper("testing")');
    expect(result).toBe('strtoupper("testing")');
});

test('strlen compile', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('strlen("Hats are cool")');
    expect(result).toBe('strlen("Hats are cool");');
});

test('substr compile without length', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('substr("Hats are cool", 0)');
    expect(result).toBe('substr("Hats are cool", 0);');
});

test('substr evaluate without length', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.evaluate('substr("Hats are cool", 5)');
    expect(result).toBe('are cool');
});

test('substr compile with length', () => {
    let el = new ExpressionLanguage(null, [new StringProvider()]);
    let result = el.compile('substr("Hats are cool", 0, 3)');
    expect(result).toBe('substr("Hats are cool", 0, 3);');
});
