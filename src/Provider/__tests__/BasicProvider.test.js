import ExpressionLanguage from "../../ExpressionLanguage";
import BasicProvider from "../BasicProvider";

test('isset evaluate', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo['bar']\")", {foo: {bar: 'yep'}});
    expect(result).toBe(true);

    let result2 = el.evaluate('isset(\'foo["bar"]\')', {foo: {bar: 'yep'}});
    expect(result2).toBe(true);
});

test('isset short circuit', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo['bar']\") or foo['baz'] == 'yep'", {foo: {bar: 'yep'}});
    expect(result).toBe(true);

    let result2 = el.evaluate("isset(\"foo['bar']\") and foo['bar'] == 'yep'", {foo: {baz: 'yep'}});
    expect(result2).toBe(false);
});

test('isset deep resolution', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo['bar']['buzz']\") and foo['bar']['buzz'] == 'yep'", {foo: {bar: {buzz: 'yep'}}});
    expect(result).toBe(true);

    let result2 = el.evaluate("isset(\"foo['bar']['buzz']\") and foo['bar']['buzz'] == 'yeppers'", {foo: {bar: {buzz: 'yep'}}});
    expect(result2).toBe(false);
});

test('isset array resolution', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo[0]['buzz']\") and foo[0]['buzz'] == 'yep'", {foo: [{buzz: 'yep'}]});
    expect(result).toBe(true);
});

test('isset with dot notation', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo.bar\") and foo.bar == 'yep'", {foo: {bar: 'yep'}});
    expect(result).toBe(true);

    let result2 = el.evaluate("isset(\"foo.bar.buzz\") and foo.bar.buzz == 'yep'", {foo: {bar: {buzz: 'yep'}}});
    expect(result2).toBe(true);
});

test('isset with ! operator', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("!isset(\"foo.baz\") and foo.bar == 'yep'", {foo: {bar: 'yep'}});
    expect(result).toBe(true);
});

test('isset with not operator', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("not isset(\"foo.baz\") and foo.bar == 'yep'", {foo: {bar: 'yep'}});
    expect(result).toBe(true);
});

test('isset with resolved (non-string) arguments', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);

    // Resolved values that are set
    expect(el.evaluate('isset(foo.bar)', { foo: { bar: 1 } })).toBe(true);
    expect(el.evaluate('isset(foo.bar)', { foo: { bar: 'hello' } })).toBe(true);
    expect(el.evaluate('isset(foo.bar)', { foo: { bar: 0 } })).toBe(true);
    expect(el.evaluate('isset(foo.bar)', { foo: { bar: false } })).toBe(true);
    expect(el.evaluate('isset(foo.bar)', { foo: { bar: '' } })).toBe(true);

    // Resolved values that are not set
    expect(el.evaluate('isset(foo)', { foo: null })).toBe(false);
    expect(el.evaluate('isset(foo)', { foo: undefined })).toBe(false);
});

test('isset with null-safe resolved arguments', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);

    // null-safe operator resolves to null when path doesn't exist
    expect(el.evaluate('isset(foo?.bar)', { foo: null })).toBe(false);
    expect(el.evaluate('isset(foo?.bar)', { foo: { bar: 'yep' } })).toBe(true);
});

test('isset is false for a compound path whose base variable is present but undefined', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let result = el.evaluate("isset(\"foo['bar']\")", {foo: undefined});
    expect(result).toBe(false);
});

test('isset with a bare (non-compound) path string checks the variable directly', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);

    expect(el.evaluate('isset("foo")', {foo: 'value'})).toBe(true);
    expect(el.evaluate('isset("foo")', {foo: undefined})).toBe(false);
});

test('isset compile with an expression path is self-contained', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    let compiled = el.compile('isset(foo.bar)', ['foo']);
    expect(compiled).toBe('(function(){try{var __v=(foo.bar);return __v!==null&&__v!==undefined;}catch(e){return false;}})()');

    let fn = new Function('foo', 'return ' + compiled + ';');
    expect(fn({ bar: 1 })).toBe(true);
    expect(fn({})).toBe(false);
    expect(fn(null)).toBe(false);
});

test('isset compile rejects the string-literal path calling style', () => {
    let el = new ExpressionLanguage(null, [new BasicProvider()]);
    expect(() => el.compile("isset(\"foo['bar']\")", ['foo'])).toThrow(/does not support compile\(\)/);
});
