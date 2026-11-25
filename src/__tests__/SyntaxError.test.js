import SyntaxError from "../SyntaxError";

test('toString includes the expression when one is provided', () => {
    let error = new SyntaxError('Unexpected token', 3, 'foo.bar');
    expect(error.toString()).toBe('SyntaxError: Unexpected token around position 3 for expression `foo.bar`.');
});

test('toString omits the expression clause when none is provided', () => {
    let error = new SyntaxError('Unexpected token', 3);
    expect(error.toString()).toBe('SyntaxError: Unexpected token around position 3.');
});

test('toString suggests the closest proposal when the subject is a close match', () => {
    let error = new SyntaxError('Variable "fo" is not valid', 1, 'fo', 'fo', ['foo', 'bar']);
    expect(error.toString()).toContain('Did you mean "foo"?');
});

test('toString suggests nothing when no proposal is close enough', () => {
    let error = new SyntaxError('Variable "xyz" is not valid', 1, 'xyz', 'xyz', ['foo', 'bar']);
    expect(error.toString()).not.toContain('Did you mean');
});

test('the position, the expression and the hint are part of the message itself, like Symfony\'s', () => {
    let error = new SyntaxError('Variable "fo" is not valid', 1, 'fo', 'fo', ['foo', 'bar']);

    expect(error.message).toBe('Variable "fo" is not valid around position 1 for expression `fo`. Did you mean "foo"?');
    expect(error.name).toBe('SyntaxError');
    expect(error.cursor).toBe(1);
    expect(error.expression).toBe('fo');
    expect(error.subject).toBe('fo');
    expect(error.proposals).toEqual(['foo', 'bar']);
});

test('trailing dots of the message are not repeated before the position', () => {
    expect(new SyntaxError('Unexpected token...', 2).message).toBe('Unexpected token around position 2.');
});

test('the position defaults to 0 and the expression to nothing', () => {
    expect(new SyntaxError('Oops').message).toBe('Oops around position 0.');
});

test('computes 1-based line and column from 1-based Symfony token cursors', () => {
    const error = new SyntaxError('Unexpected token', 9, 'a + b * c');
    expect(error.line).toBe(1);
    expect(error.column).toBe(9);
});

test('computes line and column for multi-line expressions (LF and CRLF)', () => {
    const multilineLf = 'a + b\n* c\n+ d';
    // '*' is at 0-based index 6, so 1-based token cursor is 7
    const errorLf = new SyntaxError('Unexpected token', 7, multilineLf);
    expect(errorLf.line).toBe(2);
    expect(errorLf.column).toBe(1);

    const multilineCrlf = 'a + b\r\n* c\r\n+ d';
    // '*' is at 0-based index 7 (after 'a + b\r\n'), so 1-based token cursor is 8
    const errorCrlf = new SyntaxError('Unexpected token', 8, multilineCrlf);
    expect(errorCrlf.line).toBe(2);
    expect(errorCrlf.column).toBe(1);
});

test('formatPretty renders a formatted code frame pointing directly at the offending token', () => {
    const error = new SyntaxError('Variable "nam" is not valid', 1, 'nam + 1', 'nam', ['name']);
    const pretty = error.formatPretty();

    expect(pretty).toBe([
        'Variable "nam" is not valid around position 1 for expression `nam + 1`. Did you mean "name"?',
        '1 | nam + 1',
        '  | ^',
    ].join('\n'));
});

test('end-to-end ExpressionLanguage.parse and Lexer preserve multi-line code frames and exact caret alignment', () => {
    const { ExpressionLanguage, tokenize } = require('../index');
    const el = new ExpressionLanguage();

    // Parser error on line 2 (with CRLF line endings)
    let parseErr;
    try {
        el.parse('a +\r\n  * c', ['a', 'c']);
    } catch (e) {
        parseErr = e;
    }
    expect(parseErr).toBeInstanceOf(SyntaxError);
    expect(parseErr.line).toBe(2);
    expect(parseErr.column).toBe(3);
    expect(parseErr.formatPretty()).toBe([
        'Unexpected token "operator" of value "*" around position 8 for expression `a +    * c`.',
        '2 |   * c',
        '  |   ^',
    ].join('\n'));

    // Lexer error (0-based cursor) on line 2
    let lexErr;
    try {
        tokenize('a + b\n  @ c');
    } catch (e) {
        lexErr = e;
    }
    expect(lexErr).toBeInstanceOf(SyntaxError);
    expect(lexErr.line).toBe(2);
    expect(lexErr.column).toBe(3);
    expect(lexErr.formatPretty()).toBe([
        'Unexpected character "@" around position 8 for expression `a + b   @ c`.',
        '2 |   @ c',
        '  |   ^',
    ].join('\n'));
});

test('formatPretty returns plain message when no expression is provided', () => {
    const error = new SyntaxError('Oops', 5);
    expect(error.formatPretty()).toBe(error.message);
});
