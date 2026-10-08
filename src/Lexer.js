import SyntaxError from "./SyntaxError";
import {Token, TokenStream} from "./TokenStream";
import {stripcslashes} from "./lib/stripcslashes";

// Same grammar as Symfony's Lexer. Every pattern is sticky so it is matched at the cursor without slicing the input.
const LNUM = '[0-9]+(?:_[0-9]+)*';
const NUMBER_REGEX = new RegExp(`(?:\\.${LNUM}|${LNUM}(?:\\.(?!\\.)(?:${LNUM})?)?)(?:[eE][+-]?${LNUM})?`, 'y');
const STRING_REGEX = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/ys;
const COMMENT_REGEX = /\/\*.*?\*\//y;
const NAME_REGEX = /[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/y;

// Order matters: the first operator that matches at the cursor wins (e.g. "not in" before "not", "!==" before "!").
const WORD_OPERATORS = ['starts with', 'ends with', 'contains', 'matches', 'not in', 'not', 'xor', 'and', 'or', 'in'];
const SYMBOL_OPERATORS = ['===', '!==', '||', '&&', '==', '!=', '>=', '<=', '..', '**', '<<', '>>', '!', '|', '^', '&', '<', '>', '+', '-', '~', '*', '/', '%'];

function matchAt(regex, expression, cursor) {
    regex.lastIndex = cursor;

    return regex.exec(expression);
}

/**
 * Word based operators (and, or, in, ...) only count as operators when they stand on their own:
 * after the start of the expression, a whitespace or an opening parenthesis, and before a whitespace
 * or an opening parenthesis. That keeps "foo.not(...)", "index" or "android" from being split up.
 */
function extractOperator(expression, cursor) {
    const previous = cursor === 0 ? ' ' : expression[cursor - 1];
    const standsAlone = /[\s(]/.test(previous);

    if (standsAlone) {
        for (const operator of WORD_OPERATORS) {
            if (expression.startsWith(operator, cursor) && /[\s(]/.test(expression[cursor + operator.length] ?? '')) {
                return operator;
            }
        }
    }

    for (const operator of SYMBOL_OPERATORS) {
        if (expression.startsWith(operator, cursor)) {
            return operator;
        }
    }

    return null;
}

function extractName(expression, cursor) {
    const match = matchAt(NAME_REGEX, expression, cursor);

    return match ? match[0] : null;
}

export function tokenize(expression) {
    expression = expression.replace(/\r|\n|\t|\v|\f/g, ' ');
    let cursor = 0,
        tokens = [],
        brackets = [],
        end = expression.length,
        match;

    while (cursor < end) {
        if (' ' === expression[cursor]) {
            ++cursor;
            continue;
        }

        if ((match = matchAt(NUMBER_REGEX, expression, cursor))) {
            // numbers
            const numberToken = new Token(Token.NUMBER_TYPE, Number(match[0].replace(/_/g, '')), cursor + 1);
            // PHP tells 1.0 / 1e3 (floats) from 1 (an int); a JavaScript number cannot, so the token remembers how it was written
            numberToken.isFloat = /[.eE]/.test(match[0]);
            tokens.push(numberToken);
            cursor += match[0].length;
        } else if ('([{'.indexOf(expression[cursor]) >= 0) {
            // opening bracket
            brackets.push([expression[cursor], cursor]);
            tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
            ++cursor;
        } else if (')]}'.indexOf(expression[cursor]) >= 0) {
            // closing bracket
            if (brackets.length === 0) {
                throw new SyntaxError(`Unexpected "${expression[cursor]}"`, cursor, expression);
            }

            let [expect, cur] = brackets.pop(),
                matchExpect = expect.replace("(", ")").replace("{", "}").replace("[", "]");
            if (expression[cursor] !== matchExpect) {
                throw new SyntaxError(`Unclosed "${expect}"`, cur, expression);
            }

            tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
            ++cursor;
        } else if ((match = matchAt(STRING_REGEX, expression, cursor))) {
            // strings
            tokens.push(new Token(Token.STRING_TYPE, stripcslashes(match[0].slice(1, -1)), cursor + 1));
            cursor += match[0].length;
        } else if ((match = matchAt(COMMENT_REGEX, expression, cursor))) {
            // comments
            cursor += match[0].length;
        } else if (expression.startsWith("\\\\", cursor)) {
            // Two backslashes outside of strings represent a single literal backslash token
            tokens.push(new Token(Token.PUNCTUATION_TYPE, "\\", cursor + 1));
            cursor += 2;
        } else {
            // After a dot accessor ('.' or '?.') prefer a name, so "foo.matches" is a property and not an operator
            const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
            const afterAccessor = lastToken !== null
                && lastToken.type === Token.PUNCTUATION_TYPE
                && (lastToken.value === '.' || lastToken.value === '?.');
            let name = afterAccessor ? extractName(expression, cursor) : null;
            let operator = name === null ? extractOperator(expression, cursor) : null;

            if (name !== null) {
                tokens.push(new Token(Token.NAME_TYPE, name, cursor + 1));
                cursor += name.length;
            } else if (operator !== null) {
                tokens.push(new Token(Token.OPERATOR_TYPE, operator, cursor + 1));
                cursor += operator.length;
            } else if (expression.startsWith('?.', cursor) || expression.startsWith('??', cursor)) {
                // null-safe & null-coalescing
                tokens.push(new Token(Token.PUNCTUATION_TYPE, expression.substr(cursor, 2), cursor + 1));
                cursor += 2;
            } else if (".,?:".indexOf(expression[cursor]) >= 0) {
                // punctuation
                tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
                ++cursor;
            } else if ((name = extractName(expression, cursor)) !== null) {
                // names
                tokens.push(new Token(Token.NAME_TYPE, name, cursor + 1));
                cursor += name.length;
            } else {
                // unlexable
                throw new SyntaxError(`Unexpected character "${expression[cursor]}"`, cursor, expression);
            }
        }
    }

    tokens.push(new Token(Token.EOF_TYPE, null, cursor + 1));

    if (brackets.length > 0) {
        let [expect, cur] = brackets.pop();
        throw new SyntaxError(`Unclosed "${expect}"`, cur, expression);
    }

    return new TokenStream(expression, tokens);
}
