import {addcslashes} from "../addcslashes";

test('escapes every character in a simple (non-range) charlist', () => {
    // This is the shape actually used by Compiler.string/Node.dumpString in this codebase.
    expect(addcslashes('say "hi"', "\0\t\"\\")).toBe('say \\"hi\\"');
});

test('escapes an ascending character range (documented example)', () => {
    expect(addcslashes('foo[ ]', 'A..z')).toBe('\\f\\o\\o\\[ \\]');
});

test('treats a descending range as individual literal characters instead of a range (documented example)', () => {
    expect(addcslashes("zoo['.']", 'z..A')).toBe("\\zoo['\\.']");
});

test('renders known control characters using their C-style escape letter', () => {
    expect(addcslashes('a\tb\nc\r', '\0..\x1F')).toBe('a\\tb\\nc\\r');
});

test('throws when a range has no end point', () => {
    expect(() => addcslashes('x', 'a..')).toThrow('Range with no end point');
});

test('leaves characters not in the charlist untouched', () => {
    expect(addcslashes('hello', '')).toBe('hello');
});
