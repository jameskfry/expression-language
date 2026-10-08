import SyntaxError from "../SyntaxError";

/**
 * Converts a PHP/PCRE style pattern as accepted by Symfony's `matches` operator
 * ("/regex/flags", or any other non-alphanumeric delimiter such as "#regex#i" or
 * "{regex}i") into a JavaScript RegExp.
 *
 * IMPORTANT: this function is also embedded verbatim, via Function#toString(),
 * into the output of ExpressionLanguage#compile() when the pattern is only known
 * at runtime. It therefore has to stay self-contained and written in plain ES5
 * (no helpers, no destructuring/spread/template literals that a transpiler would
 * replace with references to external helper functions).
 *
 * @param {string} pattern
 * @returns {RegExp}
 * @throws {Error} with a message starting with "Regexp ... is not valid"
 */
export function toRegExp(pattern) {
    var invalid = function (reason) {
        var e = new Error('Regexp "' + pattern + '" passed to "matches" is not valid: ' + reason);
        e.name = 'SyntaxError';
        return e;
    };

    if (typeof pattern !== 'string') {
        throw invalid('the pattern must be a string.');
    }

    var delimiter = pattern.charAt(0);
    if (delimiter === '' || /[a-zA-Z0-9\\\s]/.test(delimiter)) {
        throw invalid('delimiter must not be alphanumeric, backslash, or whitespace.');
    }

    var closers = {'(': ')', '[': ']', '{': '}', '<': '>'};
    var closer = closers[delimiter] !== undefined ? closers[delimiter] : delimiter;
    var end = pattern.lastIndexOf(closer);
    if (end <= 0) {
        throw invalid('no ending delimiter "' + closer + '" found.');
    }

    var source = pattern.slice(1, end);
    var phpFlags = pattern.slice(end + 1);
    var jsFlags = '';
    for (var i = 0; i < phpFlags.length; i++) {
        var flag = phpFlags.charAt(i);
        if ('imsu'.indexOf(flag) === -1) {
            throw invalid('unknown or unsupported modifier "' + flag + '".');
        }
        if (jsFlags.indexOf(flag) === -1) {
            jsFlags += flag;
        }
    }

    try {
        return new RegExp(source, jsFlags);
    } catch (e) {
        throw invalid(e.message);
    }
}

const cache = new Map();
const MAX_CACHED_PATTERNS = 256;

/**
 * Evaluates the `matches` operator: whether `subject` matches the PCRE style `pattern`.
 *
 * @param {string} pattern
 * @param {*} subject null/undefined are treated as an empty string, like PHP's (string) cast
 * @returns {boolean}
 * @throws {SyntaxError} when the pattern is not a valid regex
 */
export function matches(pattern, subject) {
    let regexp = cache.get(pattern);
    if (regexp === undefined) {
        try {
            regexp = toRegExp(pattern);
        } catch (e) {
            throw new SyntaxError(e.message);
        }
        if (cache.size >= MAX_CACHED_PATTERNS) {
            cache.delete(cache.keys().next().value);
        }
        cache.set(pattern, regexp);
    }

    return regexp.test(null === subject || undefined === subject ? '' : String(subject));
}
