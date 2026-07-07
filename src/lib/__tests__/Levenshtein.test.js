import {getEditDistance} from "../Levenshtein";

test('returns the other string\'s length when either input is empty', () => {
    expect(getEditDistance('', 'abc')).toBe(3);
    expect(getEditDistance('abc', '')).toBe(3);
    expect(getEditDistance('', '')).toBe(0);
});

test('returns 0 for identical strings', () => {
    expect(getEditDistance('kitten', 'kitten')).toBe(0);
});

test('computes the edit distance between two different strings', () => {
    expect(getEditDistance('kitten', 'sitting')).toBe(3);
    expect(getEditDistance('foo', 'bar')).toBe(3);
});
