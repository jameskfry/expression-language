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
