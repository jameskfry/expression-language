import DivisionByZeroError from "../DivisionByZeroError";
import {phpTypeName} from "../lib/phpType";
import {assertRangeSize} from "../lib/range";

export const typeOf = phpTypeName;

/**
 * The rules of PHP 8 for the operators that behave differently from JavaScript's.
 *
 * Symfony's ExpressionLanguage evaluates `a + b`, `a == b`, `a && b`... with PHP's own operators, so these functions are
 * the PHP operators, written in JavaScript. They are checked against Symfony itself (see SymfonySemantics.test.js).
 *
 * Differences that remain, because JavaScript has no way to tell the two apart:
 * - there is a single number type: `1` and `1.0` are the same value (so `1 === 1.0` is true), and an integer above 2^53 is rounded
 * - a hash and an array are both "arrays", a class instance is an "object"
 */

const WHITESPACE = '[ \\t\\n\\r\\v\\f]*';
const NUMERIC_PREFIX = new RegExp('^' + WHITESPACE + '([+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?)');

/**
 * Parses the numeric prefix of a string like PHP does.
 *
 * @returns {{kind: 'numeric'|'leading'|'none', value: number}} "numeric": the whole string is a number (blanks around it are
 *          fine); "leading": it starts with one ("5 apples", "0x1A" is 0 followed by garbage); "none": it does not
 */
export function parseNumeric(string) {
    const match = NUMERIC_PREFIX.exec(string);
    if (null === match) {
        return {kind: 'none', value: 0};
    }

    const rest = string.slice(match[0].length);

    return {kind: new RegExp('^' + WHITESPACE + '$').test(rest) ? 'numeric' : 'leading', value: Number(match[1])};
}

/**
 * The number a string stands for when PHP calls it numeric ("1.5", " 1", "1e2"), null otherwise ("abc", "5 apples").
 */
function numericValue(string) {
    const parsed = parseNumeric(string);

    return 'numeric' === parsed.kind ? parsed.value : null;
}

/**
 * PHP's conversion of an operand of an arithmetic operator, null when it is not allowed.
 * A leading-numeric string ("5 apples") is accepted: PHP only warns about it.
 */
function toNumber(value) {
    switch (typeOf(value)) {
        case 'null': return 0;
        case 'bool': return value ? 1 : 0;
        case 'int':
        case 'float': return value;
        case 'string': {
            const parsed = parseNumeric(value);

            return parsed.kind === 'none' ? null : parsed.value;
        }
    }

    return null;
}

const toInt = (number) => (Number.isFinite(number) ? Math.trunc(number) : 0);

function unsupported(left, operator, right) {
    return new TypeError(`Unsupported operand types: ${typeOf(left)} ${operator} ${typeOf(right)}`);
}

function arithmetic(left, operator, right, operation) {
    const a = toNumber(left);
    const b = toNumber(right);
    if (null === a || null === b) {
        throw unsupported(left, operator, right);
    }

    return operation(a, b);
}

/**
 * PHP's float to string conversion (the `precision` setting, 14 digits, like `%.14G`) and the rest of its string conversions.
 *
 * @param {*} value
 * @returns {string}
 */
export function toStr(value) {
    switch (typeOf(value)) {
        case 'null': return '';
        case 'bool': return value ? '1' : '';
        case 'int': return Math.abs(value) <= Number.MAX_SAFE_INTEGER ? String(value) : formatFloat(value);
        case 'float': return formatFloat(value);
        case 'array': return 'Array';
    }

    return String(value);
}

function formatFloat(value) {
    if (Number.isNaN(value)) {
        return 'NAN';
    }
    if (!Number.isFinite(value)) {
        return value > 0 ? 'INF' : '-INF';
    }
    if (0 === value) {
        return Object.is(value, -0) ? '-0' : '0';
    }

    const [mantissa, exponentText] = Math.abs(value).toExponential(13).split('e');
    const exponent = Number(exponentText);
    const digits = mantissa.replace('.', '').replace(/0+$/, '') || '0';
    const sign = value < 0 ? '-' : '';

    if (exponent < -4 || exponent >= 14) {
        return `${sign}${digits[0]}.${digits.slice(1) || '0'}E${exponent < 0 ? '-' : '+'}${Math.abs(exponent)}`;
    }
    if (exponent < 0) {
        return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
    }

    const integer = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0');
    const fraction = digits.slice(exponent + 1);

    return `${sign}${integer}${fraction ? '.' + fraction : ''}`;
}

/**
 * A string argument of a PHP function (str_contains() & co.): scalars and null are converted, arrays are refused.
 */
function stringArgument(value, fn, position, name) {
    const type = typeOf(value);
    if ('array' === type || 'object' === type) {
        throw new TypeError(`${fn}(): Argument #${position} ($${name}) must be of type string, ${type} given`);
    }

    return toStr(value);
}

export function truthy(value) {
    switch (typeOf(value)) {
        case 'null': return false;
        case 'bool': return value;
        case 'int':
        case 'float': return 0 !== value;
        case 'string': return '' !== value && '0' !== value;
        case 'array': return Object.keys(value).length > 0;
    }

    return true;
}

// ------------------------------------------------------------------------------------------------------------------
// comparison
// ------------------------------------------------------------------------------------------------------------------

const UNCOMPARABLE = Symbol('uncomparable');

const sign = (number) => (number < 0 ? -1 : (number > 0 ? 1 : 0));

/**
 * PHP 8's `<=>`: -1, 0 or 1, or UNCOMPARABLE (arrays that do not have the same keys), for which every comparison is false.
 */
function compare(left, right) {
    const leftType = typeOf(left);
    const rightType = typeOf(right);

    if ('null' === leftType && 'string' === rightType) {
        return sign(compareStrings('', right));
    }
    if ('string' === leftType && 'null' === rightType) {
        return sign(compareStrings(left, ''));
    }
    if (['null', 'bool'].includes(leftType) || ['null', 'bool'].includes(rightType)) {
        return sign(Number(truthy(left)) - Number(truthy(right)));
    }

    const leftIsNumber = 'int' === leftType || 'float' === leftType;
    const rightIsNumber = 'int' === rightType || 'float' === rightType;

    if (leftIsNumber && rightIsNumber) {
        return sign(left - right);
    }
    if (leftIsNumber && 'string' === rightType) {
        const number = numericValue(right);

        return null !== number ? sign(left - number) : sign(compareStrings(toStr(left), right));
    }
    if ('string' === leftType && rightIsNumber) {
        const number = numericValue(left);

        return null !== number ? sign(number - right) : sign(compareStrings(left, toStr(right)));
    }
    if ('string' === leftType && 'string' === rightType) {
        const leftNumber = numericValue(left);
        const rightNumber = null === leftNumber ? null : numericValue(right);

        return null !== rightNumber ? sign(leftNumber - rightNumber) : sign(compareStrings(left, right));
    }
    if ('array' === leftType && 'array' === rightType) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) {
            return sign(leftKeys.length - rightKeys.length);
        }
        for (const key of leftKeys) {
            if (!Object.prototype.hasOwnProperty.call(right, key)) {
                return UNCOMPARABLE;
            }
            const result = compare(left[key], right[key]);
            if (0 !== result) {
                return result;
            }
        }

        return 0;
    }
    if ('array' === leftType) {
        return 1;
    }
    if ('array' === rightType) {
        return -1;
    }

    // objects: the same instance, or instances of the same class with equal properties
    if (left === right) {
        return 0;
    }
    if ('object' === leftType && 'object' === rightType && left.constructor === right.constructor) {
        return compare({...left}, {...right});
    }

    return UNCOMPARABLE;
}

const compareStrings = (left, right) => (left < right ? -1 : (left > right ? 1 : 0));

export const eq = (left, right) => compare(left, right) === 0;
export const ne = (left, right) => !eq(left, right);
export const lt = (left, right) => compare(left, right) === -1;
export const gt = (left, right) => compare(right, left) === -1;
export const le = (left, right) => { const result = compare(left, right); return result === -1 || result === 0; };
export const ge = (left, right) => { const result = compare(right, left); return result === -1 || result === 0; };

/**
 * PHP's `===`: same type and same value; arrays have the same keys, in the same order, with identical values.
 */
export function identical(left, right) {
    const leftType = typeOf(left);
    if (leftType !== typeOf(right)) {
        // int and float are one type for JavaScript
        return ['int', 'float'].includes(leftType) && ['int', 'float'].includes(typeOf(right)) && left === right;
    }

    if ('array' === leftType) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);

        return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && identical(left[key], right[key]));
    }

    return left === right || (null === left && null === right) || (undefined === left && undefined === right) || (null === left && undefined === right) || (undefined === left && null === right);
}

export const notIdentical = (left, right) => !identical(left, right);

// ------------------------------------------------------------------------------------------------------------------
// arithmetic
// ------------------------------------------------------------------------------------------------------------------

// negative zero is a float in PHP; `0 * -1` is the integer 0
const noNegativeZero = (number) => (0 === number ? 0 : number);

export function add(left, right) {
    if ('array' === typeOf(left) && 'array' === typeOf(right)) {
        // array union: the keys of the left one win
        if (Object.keys(right).length === 0) {
            return left;
        }
        if (Object.keys(left).length === 0) {
            return right;
        }
        if (Array.isArray(left) && Array.isArray(right)) {
            return left.concat(right.slice(left.length));
        }

        return {...right, ...left};
    }

    return arithmetic(left, '+', right, (a, b) => a + b);
}

export const sub = (left, right) => arithmetic(left, '-', right, (a, b) => a - b);
export const mul = (left, right) => arithmetic(left, '*', right, (a, b) => a * b);
export const pow = (left, right) => arithmetic(left, '**', right, (a, b) => Math.pow(a, b));

export function div(left, right) {
    // the check of Symfony's BinaryNode (a loose `0 == $right`) comes before the one of PHP itself
    if (eq(0, right)) {
        throw new DivisionByZeroError('Division by zero.');
    }

    return arithmetic(left, '/', right, (a, b) => {
        if (0 === b) {
            throw new DivisionByZeroError('Division by zero');
        }

        return a / b;
    });
}

export function mod(left, right) {
    if (eq(0, right)) {
        throw new DivisionByZeroError('Modulo by zero.');
    }

    return arithmetic(left, '%', right, (a, b) => {
        const divisor = toInt(b);
        if (0 === divisor) {
            throw new DivisionByZeroError('Modulo by zero');
        }

        return noNegativeZero(toInt(a) % divisor);
    });
}

export function neg(value) {
    const number = toNumber(value);
    if (null === number) {
        throw unsupported(value, '*', -1);
    }

    return noNegativeZero(-number);
}

export const plus = (value) => value;

// ------------------------------------------------------------------------------------------------------------------
// ranges
// ------------------------------------------------------------------------------------------------------------------

/**
 * PHP's range() for the operands an expression can reasonably have: numbers, numeric strings ("1".."3" is [1, 2, 3], whereas
 * JavaScript would keep the first one a string), booleans and null (as integers), and characters ("a".."e").
 *
 * PHP's own handling of what is stranger (an array, a numeric string with a fraction next to an integer...) changes from one
 * version to the next: an array is refused here and the rest follows PHP 8.3+.
 */
export function range(start, end) {
    const bounds = [start, end].map((bound, index) => {
        switch (typeOf(bound)) {
            case 'null': return 0;
            case 'bool': return bound ? 1 : 0;
            case 'int':
            case 'float':
            case 'string': return bound;
        }

        throw new TypeError(`range(): Argument #${index + 1} ($${index === 0 ? 'start' : 'end'}) must be of type string|int|float, ${typeOf(bound)} given`);
    });

    // two strings that are not numbers are two characters: the first byte of each is what counts
    if (bounds.every((bound) => 'string' === typeof bound && '' !== bound && null === numericValue(bound))) {
        const first = bounds[0].charCodeAt(0);
        const last = bounds[1].charCodeAt(0);
        const step = first <= last ? 1 : -1;
        const characters = [];
        for (let code = first; step > 0 ? code <= last : code >= last; code += step) {
            characters.push(String.fromCharCode(code));
        }

        return characters;
    }

    // otherwise it is numbers, and a string stands for the number it starts with ("2x" is 2, "abc" is 0)
    const [low, high] = bounds.map((bound) => ('string' === typeof bound ? parseNumeric(bound).value : bound));
    const count = Math.floor(Math.abs(high - low)) + 1;
    assertRangeSize(count, low, high);

    const step = low <= high ? 1 : -1;
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
        result[i] = low + i * step;
    }

    return result;
}

// ------------------------------------------------------------------------------------------------------------------
// bitwise
// ------------------------------------------------------------------------------------------------------------------

const wrap64 = (big) => Number(BigInt.asIntN(64, big));

function bytewise(left, right, operation, length) {
    let result = '';
    for (let i = 0; i < length(left.length, right.length); i++) {
        result += String.fromCharCode(operation(left.charCodeAt(i) || 0, right.charCodeAt(i) || 0) & 0xFFFF);
    }

    return result;
}

function bitwise(left, operator, right, operation, stringLength) {
    // two strings are combined byte by byte
    if ('string' === typeof left && 'string' === typeof right) {
        return bytewise(left, right, operation, stringLength);
    }

    return arithmetic(left, operator, right, (a, b) => wrap64(operation(BigInt(toInt(a)), BigInt(toInt(b)))));
}

const minLength = (a, b) => Math.min(a, b);
const maxLength = (a, b) => Math.max(a, b);

export const bitAnd = (left, right) => bitwise(left, '&', right, (a, b) => a & b, minLength);
export const bitOr = (left, right) => bitwise(left, '|', right, (a, b) => a | b, maxLength);
export const bitXor = (left, right) => bitwise(left, '^', right, (a, b) => a ^ b, minLength);

function shift(left, operator, right, operation) {
    return arithmetic(left, operator, right, (a, b) => {
        const count = toInt(b);
        if (count < 0) {
            const error = new RangeError('Bit shift by negative number');
            error.name = 'ArithmeticError';
            throw error;
        }

        return wrap64(operation(BigInt(toInt(a)), BigInt(Math.min(count, 64))));
    });
}

export const shl = (left, right) => shift(left, '<<', right, (a, count) => a << count);
export const shr = (left, right) => shift(left, '>>', right, (a, count) => a >> count);

export function bitNot(value) {
    switch (typeOf(value)) {
        case 'int':
        case 'float': return wrap64(~BigInt(toInt(value)));
        case 'string': return Array.from(value, (char) => String.fromCharCode(~char.charCodeAt(0) & 0xFF)).join('');
    }

    throw new TypeError(`Cannot perform bitwise not on ${typeOf(value)}`);
}

// ------------------------------------------------------------------------------------------------------------------
// strings, arrays
// ------------------------------------------------------------------------------------------------------------------

export const str = toStr;

/**
 * The subject of `matches`: Symfony hands it to a function typed `?string`, which takes scalars and null, not an array.
 */
export function matchSubject(value) {
    const type = typeOf(value);
    if ('array' === type || 'object' === type) {
        throw new TypeError(`Symfony\\Component\\ExpressionLanguage\\Node\\BinaryNode::evaluateMatches(): Argument #2 ($str) must be of type ?string, ${type} given`);
    }

    return toStr(value);
}
export const concat = (left, right) => toStr(left) + toStr(right);

export function contains(left, right, ignoreCase = false) {
    const haystack = stringArgument(left, 'str_contains', 1, 'haystack');
    const needle = stringArgument(right, 'str_contains', 2, 'needle');

    return ignoreCase ? haystack.toLowerCase().includes(needle.toLowerCase()) : haystack.includes(needle);
}

export function startsWith(left, right, ignoreCase = false) {
    const haystack = stringArgument(left, 'str_starts_with', 1, 'haystack');
    const needle = stringArgument(right, 'str_starts_with', 2, 'needle');

    return ignoreCase ? haystack.toLowerCase().startsWith(needle.toLowerCase()) : haystack.startsWith(needle);
}

export function endsWith(left, right, ignoreCase = false) {
    const haystack = stringArgument(left, 'str_ends_with', 1, 'haystack');
    const needle = stringArgument(right, 'str_ends_with', 2, 'needle');

    return ignoreCase ? haystack.toLowerCase().endsWith(needle.toLowerCase()) : haystack.endsWith(needle);
}

/**
 * `in_array($needle, $haystack, true)`: the values of an array or a hash are compared strictly.
 */
export function inArray(needle, haystack) {
    if ('array' !== typeOf(haystack)) {
        throw new TypeError(`in_array(): Argument #2 ($haystack) must be of type array, ${typeOf(haystack)} given`);
    }

    return Object.values(haystack).some((value) => identical(value, needle));
}

export const notInArray = (needle, haystack) => !inArray(needle, haystack);
