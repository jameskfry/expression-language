import {tokenize} from "../Lexer";
import {Token, TokenStream} from "../TokenStream";

function getTokenizeData() {
    return [
        [
            [new Token(Token.NAME_TYPE, 'a', 3)],
            '  a  ',
        ],
        [
            [new Token(Token.NAME_TYPE, 'a', 1)],
            'a',
        ],
        [
            [new Token(Token.STRING_TYPE, 'foo', 1)],
            '"foo"',
        ],
        [
            [new Token(Token.NUMBER_TYPE, '3', 1)],
            '3',
        ],
        [
            [new Token(Token.OPERATOR_TYPE, '+', 1)],
            '+',
        ],
        [
            [new Token(Token.PUNCTUATION_TYPE, '.', 1)],
            '.',
        ],
        [
            [
                new Token(Token.PUNCTUATION_TYPE, '(', 1),
                new Token(Token.NUMBER_TYPE, '3', 2),
                new Token(Token.OPERATOR_TYPE, '+', 4),
                new Token(Token.NUMBER_TYPE, '5', 6),
                new Token(Token.PUNCTUATION_TYPE, ')', 7),
                new Token(Token.OPERATOR_TYPE, '~', 9),
                new Token(Token.NAME_TYPE, 'foo', 11),
                new Token(Token.PUNCTUATION_TYPE, '(', 14),
                new Token(Token.STRING_TYPE, 'bar', 15),
                new Token(Token.PUNCTUATION_TYPE, ')', 20),
                new Token(Token.PUNCTUATION_TYPE, '.', 21),
                new Token(Token.NAME_TYPE, 'baz', 22),
                new Token(Token.PUNCTUATION_TYPE, '[', 25),
                new Token(Token.NUMBER_TYPE, '4', 26),
                new Token(Token.PUNCTUATION_TYPE, ']', 27),
                new Token(Token.OPERATOR_TYPE, '-', 29),
                new Token(Token.NUMBER_TYPE, 1990, 31),
                new Token(Token.OPERATOR_TYPE, '+', 39),
                new Token(Token.OPERATOR_TYPE, '~', 41),
                new Token(Token.NAME_TYPE, 'qux', 42),
            ],
            '(3 + 5) ~ foo("bar").baz[4] - 1.99E+3 + ~qux',
        ],
        [
            [
                new Token(Token.NUMBER_TYPE, 0.01, 1)
            ],
            '1e-2'
        ],
        [
            [
                new Token(Token.NUMBER_TYPE, 1000000, 1)
            ],
            '1_000_000'
        ],
        [
            [new Token(Token.OPERATOR_TYPE, '..', 1)],
            '..',
        ],
        [
            [
                new Token(Token.NUMBER_TYPE, 23, 1),
                new Token(Token.OPERATOR_TYPE, '..', 3),
                new Token(Token.NUMBER_TYPE, 26, 5),
            ],
            '23..26',
        ],
        [
            [new Token(Token.OPERATOR_TYPE, '!', 1)],
            '!',
        ],
        [
            [new Token(Token.STRING_TYPE, '#foo', 1)],
            "'#foo'",
        ],
        [
            [new Token(Token.STRING_TYPE, '#foo', 1)],
            '"#foo"',
        ],
        [
            [new Token(Token.STRING_TYPE, 'foo["bar"]', 1)],
            "'foo[\"bar\"]'"
        ],
        [
            [
                new Token(Token.NAME_TYPE, 'foo', 1),
                new Token(Token.PUNCTUATION_TYPE, '.', 4),
                new Token(Token.NAME_TYPE, 'not', 5),
                new Token(Token.OPERATOR_TYPE, 'in', 9),
                new Token(Token.PUNCTUATION_TYPE, '[', 12),
                new Token(Token.NAME_TYPE, 'bar', 13),
                new Token(Token.PUNCTUATION_TYPE, ']', 16),
            ],
            'foo.not in [bar]',
        ],
        [
            [new Token(Token.NUMBER_TYPE, 0.787, 1)],
            '0.787',
        ],
        [
            [new Token(Token.NUMBER_TYPE, 0.1234, 1)],
            '.1234',
        ],
        [
            [new Token(Token.NUMBER_TYPE, 188165.1178, 1)],
            '188_165.1_178',
        ],
        [
            [
                new Token(Token.OPERATOR_TYPE, '-', 1),
                new Token(Token.NUMBER_TYPE, 7189000000.0, 2),
            ],
            '-.7_189e+10',
        ],
        [
            [
                new Token(Token.NUMBER_TYPE, 65536, 1),
            ],
            '65536 /* this is 2^16 */',
        ],
        [
            [
                new Token(Token.NUMBER_TYPE, 2, 1),
                new Token(Token.OPERATOR_TYPE, '*', 21),
                new Token(Token.NUMBER_TYPE, 4, 23),
            ],
            '2 /* /* comment1 */ * 4',
        ],
        [
            [
                new Token(Token.STRING_TYPE, '/* this is', 1),
                new Token(Token.OPERATOR_TYPE, '~', 14),
                new Token(Token.STRING_TYPE, 'not a comment */', 16),
            ],
            '"/* this is" ~ "not a comment */"',
        ],
        [
            [
                new Token(Token.STRING_TYPE, '/* this is not a comment */', 1),
            ],
            '"/* this is not a comment */"',
        ],
        [
            [
                new Token(Token.NAME_TYPE, 'foo', 1),
                new Token(Token.OPERATOR_TYPE, 'xor', 5),
                new Token(Token.NAME_TYPE, 'bar', 9),
            ],
            'foo xor bar',
        ],
        [
            [
                new Token(Token.PUNCTUATION_TYPE, '\\', 1)
            ],
            '\\\\'
        ]
    ];
}

test('tokenize throws error with message', () => {
    let expression = "service(faulty.expression.example').dummyMethod()";
    try {
        tokenize(expression);
        expect(true).toBe(false).message("An error should have been thrown.");
    }
    catch(err) {
        expect(err.toString()).toContain('Unexpected character "\'"')
    }
});

test('tokenize throws error on unclosed brace', () => {
    let expression = "service(unclosed.expression.dummyMethod()";
    try {
        tokenize(expression);
        expect(true).toBe(false).message("An error should have been thrown.");
    }
    catch(err) {
        expect(err.toString()).toContain('Unclosed "("');
    }
});

test('tokenize ignores an unclosed block comment through the end of the expression', () => {
    let stream = tokenize('65536 /* unclosed');

    expect(stream.tokens).toHaveLength(2);
    expect(stream.tokens[0].type).toBe(Token.NUMBER_TYPE);
    expect(stream.tokens[0].value).toBe(65536);
    expect(stream.tokens[1].type).toBe(Token.EOF_TYPE);
});

test('tokenize throws on an unexpected closing punctuation with nothing open', () => {
    expect(() => tokenize(')')).toThrow('Unexpected ")"');
});

// Token instances carry per-instance arrow-function methods, so toEqual (which compares those
// function references) can't be used across separately-constructed tokens; compare fields instead.
function expectToken(token, type, value, cursor) {
    expect(token.type).toBe(type);
    expect(token.value).toBe(value);
    expect(token.cursor).toBe(cursor);
}

test('tokenize falls back to a symbolic operator right after a dot accessor when no name matches', () => {
    // A symbolic operator (not identifier-shaped) can't be matched by extractName, so this exercises
    // the extractOperator fallback inside the "preferName" branch.
    let stream = tokenize('foo.+');

    expectToken(stream.tokens[0], Token.NAME_TYPE, 'foo', 1);
    expectToken(stream.tokens[1], Token.PUNCTUATION_TYPE, '.', 4);
    expectToken(stream.tokens[2], Token.OPERATOR_TYPE, '+', 5);
});

test('tokenize treats a "?." or "??" immediately after a dot accessor as its own punctuation token', () => {
    let stream = tokenize('foo.?.bar');

    expectToken(stream.tokens[0], Token.NAME_TYPE, 'foo', 1);
    expectToken(stream.tokens[1], Token.PUNCTUATION_TYPE, '.', 4);
    expectToken(stream.tokens[2], Token.PUNCTUATION_TYPE, '?.', 5);
    expectToken(stream.tokens[3], Token.NAME_TYPE, 'bar', 7);
});

test('tokenize treats a lone ".", ",", "?", or ":" right after a dot accessor as its own punctuation token', () => {
    let stream = tokenize('foo.:');

    expectToken(stream.tokens[0], Token.NAME_TYPE, 'foo', 1);
    expectToken(stream.tokens[1], Token.PUNCTUATION_TYPE, '.', 4);
    expectToken(stream.tokens[2], Token.PUNCTUATION_TYPE, ':', 5);
});

test('tokenize throws on an unexpected character right after a dot accessor', () => {
    expect(() => tokenize('foo.$')).toThrow('Unexpected character "$"');
});

test('tokenize', () => {
    let data = getTokenizeData();
    for (let tokenizeData of data) {
        let tokens = tokenizeData[0],
            expression = tokenizeData[1];
        tokens.push(new Token(Token.EOF_TYPE, null, expression.length + 1));

        //console.log("Testing: ", expression);

        let generatedStream = tokenize(expression),
            expectedStream = new TokenStream(expression, tokens);

        //console.log("Diff: " + JSON.stringify(generatedStream.diff(expectedStream)));

        expect(generatedStream.isEqualTo(expectedStream))
            .toBe(true);
    }
});
