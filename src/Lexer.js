import SyntaxError from "./SyntaxError";
import {Token, TokenStream} from "./TokenStream";

export function tokenize(expression) {
    expression = expression.replace(/\r|\n|\t|\v|\f/g, ' ');
    let cursor = 0,
        tokens = [],
        brackets = [],
        end = expression.length;

    while (cursor < end) {
        if (' ' === expression[cursor]) {
            ++cursor;
            continue;
        }
        // Skip block comments
        if (expression.substr(cursor, 2) === '/*') {
            const endIdx = expression.indexOf('*/', cursor + 2);
            if (endIdx === -1) {
                // Unclosed comment: ignore rest of expression
                cursor = end;
                break;
            } else {
                cursor = endIdx + 2;
                continue;
            }
        }

        let number = extractNumber(expression.substr(cursor));
        if (number !== null) {
            // numbers
            const numberLength = number.length;
            const raw = number;
            const clean = raw.replace(/_/g, '');
            // Decide integer vs float based on presence of decimal point or exponent
            if (clean.indexOf(".") === -1 && clean.indexOf("e") === -1 && clean.indexOf("E") === -1) {
                number = parseInt(clean, 10);
            }
            else {
                number = parseFloat(clean);
            }
            tokens.push(new Token(Token.NUMBER_TYPE, number, cursor + 1));
            cursor += numberLength;
        } else {
            if ('([{'.indexOf(expression[cursor]) >= 0) {
                // opening bracket
                brackets.push([expression[cursor], cursor]);
                tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
                ++cursor;
            }
            else {
                if (')]}'.indexOf(expression[cursor]) >= 0) {
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
                }
                else {
                    let str = extractString(expression.substr(cursor));
                    if (str !== null) {
                        //console.log("adding string: " + str);
                        tokens.push(new Token(Token.STRING_TYPE, str.captured, cursor + 1));
                        cursor += (str.length);
                        //console.log(`Extracted string: ${str.captured}; Remaining: ${expression.substr(cursor)}`, cursor, expression);
                    }
                    else if (expression.substr(cursor, 2) === "\\\\") {
                        // Two backslashes outside of strings represent a single literal backslash token
                        tokens.push(new Token(Token.PUNCTUATION_TYPE, "\\", cursor + 1));
                        cursor += 2;
                    }
                    else {
                        // If the previous token is a dot accessor ('.' or '?.'), prefer extracting a name before operators
                        const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
                        const preferName = lastToken && lastToken.type === Token.PUNCTUATION_TYPE && (lastToken.value === '.' || lastToken.value === '?.');

                        if (preferName) {
                            let name = extractName(expression.substr(cursor));
                            if (name) {
                                tokens.push(new Token(Token.NAME_TYPE, name, cursor + 1));
                                cursor += name.length;
                            }
                            else {
                                let operator = extractOperator(expression.substr(cursor));
                                if (operator) {
                                    tokens.push(new Token(Token.OPERATOR_TYPE, operator, cursor + 1));
                                    cursor += operator.length;
                                }
                                else if (expression.substr(cursor, 2) === '?.' || expression.substr(cursor, 2) === '??') {
                                    tokens.push(new Token(Token.PUNCTUATION_TYPE, expression.substr(cursor, 2), cursor + 1));
                                    cursor += 2;
                                }
                                else if (".,?:".indexOf(expression[cursor]) >= 0) {
                                    tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
                                    ++cursor;
                                }
                                else {
                                    throw new SyntaxError(`Unexpected character "${expression[cursor]}"`, cursor, expression);
                                }
                            }
                        }
                        else {
                            let operator = extractOperator(expression.substr(cursor));
                            if (operator) {
                                tokens.push(new Token(Token.OPERATOR_TYPE, operator, cursor + 1));
                                cursor += operator.length;
                            }
                            else {
                                if (expression.substr(cursor, 2) === '?.' || expression.substr(cursor, 2) === '??') {
                                    tokens.push(new Token(Token.PUNCTUATION_TYPE, expression.substr(cursor, 2), cursor + 1));
                                    cursor += 2;
                                }
                                else if (".,?:".indexOf(expression[cursor]) >= 0) {
                                    tokens.push(new Token(Token.PUNCTUATION_TYPE, expression[cursor], cursor + 1));
                                    ++cursor;
                                }
                                else {
                                    let name = extractName(expression.substr(cursor));
                                    if (name) {
                                        tokens.push(new Token(Token.NAME_TYPE, name, cursor + 1));
                                        cursor += name.length;
                                        //console.log(`Extracted name: ${name}; Remaining: ${expression.substr(cursor)}`, cursor, expression)
                                    }
                                    else {
                                        throw new SyntaxError(`Unexpected character "${expression[cursor]}"`, cursor, expression);
                                    }
                                }
                            }
                        }
                    }
                }
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

function extractNumber(str) {
    let extracted = null;

    // Supports:
    // - integers: 123, 1_000
    // - decimals: 123.45, .45, 123., with optional underscores in integer and fraction parts
    // - exponent: e or E with optional sign and digits (e.g., 1.23e+10, .7_189e10)
    // Note: underscores are allowed between digits but not at boundaries; we simply capture and
    // rely on parseFloat/parseInt after removing underscores implicitly by JavaScript (parseFloat ignores underscores only in modern engines, so we will strip them manually before parsing if needed elsewhere). Here we only extract the literal token string; Tokenize later uses parseInt/parseFloat which will work if underscores are removed there. Tests expect numeric values parsed correctly, so we must ensure extraction includes underscores.
    const numberRegex = /^(?:((?:\d(?:_?\d)*)\.(?:\d(?:_?\d)*)|\.(?:\d(?:_?\d)*)|(?:\d(?:_?\d)*))(?:[eE][+-]?\d(?:_?\d)*)?)/;

    let matches = str.match(numberRegex);
    if (matches && matches.length > 0) {
        extracted = matches[0];
    }
    return extracted;
}


const strRegex = /^"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/s;

function unescapeString(s, quote) {
    // Only handle escaping of backslash and the matching quote; do NOT translate control sequences (e.g., \n)
    // Replace escaped quote first, then collapse escaped backslashes
    if (quote === '"') {
        s = s.replace(/\\\"/g, '"');
    } else if (quote === "'") {
        s = s.replace(/\\'/g, "'");
    }
    // Replace double backslashes with single backslash
    s = s.replace(/\\\\/g, '\\');
    return s;
}
/**
 *
 * @param str
 * @returns {null|string}
 */
function extractString(str) {
    let extracted = null;

    if (["'", '"'].indexOf(str.substr(0, 1)) === -1) {
        return extracted;
    }

    let m = strRegex.exec(str);
    if (m !== null && m.length > 0) {
        if (typeof m[1] !== 'undefined') {
            extracted = {
                captured: unescapeString(m[1], '"')
            };
        }
        else {
            extracted = {
                captured: unescapeString(m[2], "'")
            };
        }

        extracted.length = m[0].length;
    }

    return extracted;
}


const operators = [
    "&&","and","||","or", // Binary
    "+", "-", "**", "*", "/", "%", // Arithmetic
    "&", "|", "^", ">>", "<<", // Bitwise
    "===", "!==", "!=", "==", "<=", ">=", "<", ">", // Comparison
    "contains", "matches", "starts with", "ends with",
    "not in", "in", "not", "!", "xor",
    "~", // String concatenation,
    '..', // Range function
];
const wordBasedOperators = ["and", "or", "matches", "contains", "starts with", "ends with", "not in", "in", "not", "xor"];
/**
 *
 * @param str
 * @returns {null|string}
 */
function extractOperator(str) {
    let extracted = null;
    for (let operator of operators) {
        if (str.substr(0, operator.length) === operator) {
            // If it is one of the word based operators, make sure there is a space after it
            if (wordBasedOperators.indexOf(operator) >= 0) {
                if (str.substr(0, operator.length + 1) === operator + " ") {
                    extracted = operator;
                }
            }
            else {
                extracted = operator;
            }
            break;
        }
    }
    return extracted;
}

function extractName(str) {
    let extracted = null;

    let matches = str.match(/^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/);
    if (matches && matches.length > 0) {
        extracted = matches[0];
    }

    return extracted;
}
