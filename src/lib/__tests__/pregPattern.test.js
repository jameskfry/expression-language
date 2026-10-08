import {toRegExp, matches} from "../pregPattern";
import SyntaxError from "../../SyntaxError";

test('toRegExp understands "/" and other non-alphanumeric delimiters', () => {
    expect(toRegExp('/a+/').source).toBe('a+');
    expect(toRegExp('#a/b#').test('a/b')).toBe(true);
    expect(toRegExp('~a~').source).toBe('a');
    expect(toRegExp('{a{1,2}}').source).toBe('a{1,2}');
    expect(toRegExp('(a)').source).toBe('a');
    expect(toRegExp('[a]').source).toBe('a');
    expect(toRegExp('<a>').source).toBe('a');
});

test('toRegExp maps the supported modifiers and rejects the others', () => {
    expect(toRegExp('/a/imsu').flags).toBe('imsu');
    expect(toRegExp('/a/ii').flags).toBe('i');
    for (const modifier of ['x', 'g', 'U', 'A', 'D', 'S', 'X', 'e']) {
        expect(() => toRegExp('/a/' + modifier)).toThrow('unknown or unsupported modifier');
    }
});

test('toRegExp rejects a malformed pattern', () => {
    for (const pattern of ['', 'abc', '1a1', '\\a\\', ' a ', '/abc', '(abc', '/(/', null, undefined, 5]) {
        expect(() => toRegExp(pattern)).toThrow('passed to "matches" is not valid');
    }
});

test('matches() converts its subject to a string, null being empty', () => {
    expect(matches('/^5$/', 5)).toBe(true);
    expect(matches('/^$/', null)).toBe(true);
    expect(matches('/^$/', undefined)).toBe(true);
    expect(matches('/^a/', 'abc')).toBe(true);
    expect(matches('/^a/', 'bca')).toBe(false);
});

test('matches() is stateless and raises a SyntaxError for an invalid pattern', () => {
    for (let i = 0; i < 3; i++) {
        expect(matches('/a/', 'a')).toBe(true);
    }
    expect(() => matches('/(/', 'a')).toThrow(SyntaxError);
});

test('matches() keeps working past the size of its pattern cache', () => {
    for (let i = 0; i < 600; i++) {
        expect(matches('/^' + i + '$/', String(i))).toBe(true);
    }
});

test('toRegExp survives being embedded in compiled code through Function#toString()', () => {
    const embedded = new Function('return (' + toRegExp.toString() + ');')();

    expect(embedded('/^a/i').test('ABC')).toBe(true);
    expect(() => embedded('nope')).toThrow('is not valid');
});
