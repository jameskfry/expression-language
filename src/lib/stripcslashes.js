/**
 * Port of PHP's stripcslashes(): un-quotes a string quoted with C-style escapes.
 *
 * Recognises \n \t \r \a \v \b \f, octal (\101), hex (\x41), and drops the
 * backslash in front of any other character (so \" -> ", \' -> ', \\ -> \, \d -> d).
 * The Symfony Lexer runs every string literal through it, so this keeps string
 * literals identical on both sides.
 *
 * @param {string} str
 * @returns {string}
 */
export function stripcslashes(str) {
    const simple = {n: '\n', t: '\t', r: '\r', a: '\x07', v: '\x0b', b: '\b', f: '\f'};
    const isHex = (c) => c !== undefined && /^[0-9a-fA-F]$/.test(c);
    const isOctal = (c) => c !== undefined && c >= '0' && c <= '7';
    let out = '';
    let i = 0;

    while (i < str.length) {
        const c = str[i];
        if (c !== '\\' || i + 1 >= str.length) {
            out += c;
            i++;
            continue;
        }

        const next = str[i + 1];
        if (simple[next] !== undefined) {
            out += simple[next];
            i += 2;
        } else if (next === 'x' && isHex(str[i + 2])) {
            let hex = str[i + 2];
            i += 3;
            if (isHex(str[i])) {
                hex += str[i];
                i++;
            }
            out += String.fromCharCode(parseInt(hex, 16));
        } else if (isOctal(next)) {
            let octal = '';
            i++;
            while (octal.length < 3 && isOctal(str[i])) {
                octal += str[i];
                i++;
            }
            out += String.fromCharCode(parseInt(octal, 8) & 0xFF);
        } else {
            out += next;
            i += 2;
        }
    }

    return out;
}
