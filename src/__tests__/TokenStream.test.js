import {tokenize} from "../Lexer";
import {TokenStream, Token} from "../TokenStream";

test('current/last getters track position', () => {
    let stream = tokenize("1");

    expect(stream.current.type).toBe(Token.NUMBER_TYPE);
    expect(stream.current.value).toBe(1);
    expect(stream.last).toBeUndefined();

    stream.next();

    expect(stream.current.type).toBe(Token.EOF_TYPE);
    expect(stream.last.type).toBe(Token.NUMBER_TYPE);
});

test('next throws a SyntaxError at the end of the token stream', () => {
    let stream = tokenize("1");
    stream.next(); // now at EOF

    expect(() => stream.next()).toThrow('Unexpected end of expression');
});

test('expect advances past a matching token', () => {
    let stream = tokenize("1");

    expect(() => stream.expect(Token.NUMBER_TYPE, null)).not.toThrow();
    expect(stream.current.type).toBe(Token.EOF_TYPE);
});

test('expect throws a SyntaxError describing the mismatch, with an optional message and value', () => {
    let stream = tokenize("1");

    expect(() => stream.expect(Token.STRING_TYPE)).toThrow('Unexpected token "number" of value "1" ("string" expected)');

    let stream2 = tokenize("1");
    expect(() => stream2.expect(Token.STRING_TYPE, null, "Custom context")).toThrow(
        'Custom context. Unexpected token "number" of value "1" ("string" expected)'
    );

    let stream3 = tokenize("1");
    expect(() => stream3.expect(Token.STRING_TYPE, "hello")).toThrow(
        'Unexpected token "number" of value "1" ("string" expected with value "hello")'
    );
});

test('isEOF reflects whether the current token is the EOF token', () => {
    let stream = tokenize("1");
    expect(stream.isEOF()).toBe(false);

    stream.next();
    expect(stream.isEOF()).toBe(true);
});

test('toString joins the tokens using each token\'s own toString', () => {
    let stream = tokenize("1");
    expect(stream.toString()).toBe(stream.tokens.map(t => t.toString()).join("\n"));
});

test('isEqualTo is false for null, undefined, or a stream with a different token count', () => {
    let stream = tokenize("1 + 2");

    expect(stream.isEqualTo(null)).toBe(false);
    expect(stream.isEqualTo(undefined)).toBe(false);
    expect(stream.isEqualTo(tokenize("1"))).toBe(false);
});

test('isEqualTo is true for two streams tokenized from the same expression', () => {
    let streamA = tokenize("1 + 2");
    let streamB = tokenize("1 + 2");

    expect(streamA.isEqualTo(streamB)).toBe(true);
});

test('isEqualTo is false when any token differs, and restores the compared stream\'s position', () => {
    let streamA = tokenize("1 + 2");
    let streamB = tokenize("1 + 3");
    streamB.next(); // move position to make sure it gets restored

    expect(streamA.isEqualTo(streamB)).toBe(false);
    expect(streamB.position).toBe(1);
});

test('diff returns an empty array for equal streams', () => {
    let streamA = tokenize("1 + 2");
    let streamB = tokenize("1 + 2");

    expect(streamA.diff(streamB)).toEqual([]);
});

test('diff reports the index and details of mismatched tokens', () => {
    let streamA = tokenize("1 + 2");
    let streamB = tokenize("1 + 3");

    let diff = streamA.diff(streamB);

    expect(diff).toHaveLength(1);
    expect(diff[0].index).toBe(2);
    expect(diff[0].diff.some(line => line.includes('Value'))).toBe(true);
});

test('Token.test matches by type alone or by type and value', () => {
    let token = new Token(Token.NUMBER_TYPE, 5, 1);

    expect(token.test(Token.NUMBER_TYPE)).toBe(true);
    expect(token.test(Token.NUMBER_TYPE, 5)).toBe(true);
    expect(token.test(Token.NUMBER_TYPE, 6)).toBe(false);
    expect(token.test(Token.STRING_TYPE)).toBe(false);
});

test('Token.toString formats cursor, type, and value', () => {
    let token = new Token(Token.NUMBER_TYPE, 5, 1);
    expect(token.toString()).toBe('1 [number] 5');
});

test('Token.isEqualTo is false for null/undefined and for any mismatched field', () => {
    let token = new Token(Token.NUMBER_TYPE, 5, 1);

    expect(token.isEqualTo(null)).toBe(false);
    expect(token.isEqualTo(undefined)).toBe(false);
    expect(token.isEqualTo(new Token(Token.NUMBER_TYPE, 6, 1))).toBe(false);
    expect(token.isEqualTo(new Token(Token.STRING_TYPE, 5, 1))).toBe(false);
    expect(token.isEqualTo(new Token(Token.NUMBER_TYPE, 5, 2))).toBe(false);
    expect(token.isEqualTo(new Token(Token.NUMBER_TYPE, 5, 1))).toBe(true);
});

test('Token.diff lists each mismatched field and is empty for equal tokens', () => {
    let token = new Token(Token.NUMBER_TYPE, 5, 1);

    expect(token.diff(new Token(Token.NUMBER_TYPE, 5, 1))).toEqual([]);

    let diff = token.diff(new Token(Token.STRING_TYPE, 6, 2));
    expect(diff).toHaveLength(3);
    expect(diff.some(line => line.startsWith('Value'))).toBe(true);
    expect(diff.some(line => line.startsWith('Cursor'))).toBe(true);
    expect(diff.some(line => line.startsWith('Type'))).toBe(true);
});
