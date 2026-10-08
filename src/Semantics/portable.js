import * as symfony from "./php";
import * as javascript from "./js";
import PortabilityError from "./PortabilityError";

/**
 * The "portable" rules: JavaScript's and Symfony's are both applied, and an operation that would not give the same result
 * with both is an error (PortabilityError) instead of a silent difference between the browser and the server.
 *
 * What it returns is what both agree on.
 */

const SYMBOLS = {
    add: '+', sub: '-', mul: '*', div: '/', mod: '%', pow: '**', neg: '-', bitAnd: '&', bitOr: '|', bitXor: '^', shl: '<<', shr: '>>',
    bitNot: '~', eq: '==', ne: '!=', identical: '===', notIdentical: '!==', lt: '<', gt: '>', le: '<=', ge: '>=', truthy: 'boolean test',
    range: '..', concat: '~', contains: 'contains', startsWith: 'starts with', endsWith: 'ends with', inArray: 'in', notInArray: 'not in', str: 'string conversion', matchSubject: 'matches',
};

function same(a, b) {
    if (Object.is(a, b) || a === b) {
        return true;
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return Number.isNaN(a) && Number.isNaN(b);
    }
    if (null === a || null === b || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index] && same(a[key], b[key]));
}

function attempt(ops, name, args) {
    try {
        return {value: ops[name](...args)};
    } catch (error) {
        return {error};
    }
}

function portable(name) {
    return (...args) => {
        const expected = attempt(symfony, name, args);
        const actual = attempt(javascript, name, args);

        if ('error' in expected && 'error' in actual) {
            // both refuse: the way Symfony words it is the reference
            throw expected.error;
        }
        if ('value' in expected && 'value' in actual && same(expected.value, actual.value)) {
            return expected.value;
        }

        throw new PortabilityError(SYMBOLS[name] ?? name, args, expected, actual);
    };
}

const ops = {};
for (const name of Object.keys(SYMBOLS)) {
    ops[name] = portable(name);
}

export const {
    add, sub, mul, div, mod, pow, neg, bitAnd, bitOr, bitXor, shl, shr, bitNot, eq, ne, identical, notIdentical, lt, gt, le, ge, truthy,
    concat, contains, startsWith, endsWith, inArray, notInArray, str, range, matchSubject,
} = ops;

export const plus = (value) => value;
