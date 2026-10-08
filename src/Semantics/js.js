import DivisionByZeroError from "../DivisionByZeroError";
import {phpTypeName} from "../lib/phpType";
import {range as jsRange} from "../lib/range";

/**
 * JavaScript's own rules for the operators that behave differently in PHP: `+` concatenates as soon as a string is
 * involved, `==` coerces its operands its own way, `"0"` and `[]` are truthy, bitwise operators work on 32 bits, arrays are
 * compared by identity...
 *
 * (A division by zero throws in every set of rules, see DivisionByZeroError.)
 */

const isZero = (value) => null === value || undefined === value || 0 == value;

// null / undefined become an empty string
export const str = (value) => (null === value || undefined === value) ? '' : String(value);

export const matchSubject = str;

export const add = (left, right) => left + right;
export const sub = (left, right) => left - right;
export const mul = (left, right) => left * right;
export const pow = (left, right) => Math.pow(left, right);

export function div(left, right) {
    if (isZero(right)) {
        throw new DivisionByZeroError('Division by zero.');
    }

    return left / right;
}

export function mod(left, right) {
    if (isZero(right)) {
        throw new DivisionByZeroError('Modulo by zero.');
    }

    return left % right;
}

export const neg = (value) => -value;
export const plus = (value) => value;

export const bitAnd = (left, right) => left & right;
export const bitOr = (left, right) => left | right;
export const bitXor = (left, right) => left ^ right;
export const shl = (left, right) => left << right;
export const shr = (left, right) => left >> right;
export const bitNot = (value) => ~value;

export const eq = (left, right) => left == right;
export const ne = (left, right) => left != right;
export const identical = (left, right) => left === right;
export const notIdentical = (left, right) => left !== right;
export const lt = (left, right) => left < right;
export const gt = (left, right) => left > right;
export const le = (left, right) => left <= right;
export const ge = (left, right) => left >= right;

export const truthy = (value) => !!value;

export const range = (start, end) => jsRange(start, end);

export const concat = (left, right) => str(left) + str(right);

const fold = (value, ignoreCase) => (ignoreCase ? str(value).toLowerCase() : str(value));

export const contains = (left, right, ignoreCase = false) => fold(left, ignoreCase).includes(fold(right, ignoreCase));
export const startsWith = (left, right, ignoreCase = false) => fold(left, ignoreCase).startsWith(fold(right, ignoreCase));
export const endsWith = (left, right, ignoreCase = false) => fold(left, ignoreCase).endsWith(fold(right, ignoreCase));

// the values of an array or a hash are searched, anything else is an error
export function inArray(needle, haystack) {
    if (Array.isArray(haystack)) {
        return haystack.indexOf(needle) >= 0;
    }
    if (null !== haystack && typeof haystack === 'object') {
        return Object.values(haystack).indexOf(needle) >= 0;
    }

    throw new TypeError(`in_array(): Argument #2 ($haystack) must be of type array, ${phpTypeName(haystack)} given`);
}

export const notInArray = (needle, haystack) => !inArray(needle, haystack);
