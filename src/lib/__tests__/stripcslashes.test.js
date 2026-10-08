import {stripcslashes} from "../stripcslashes";

test.each([
    ['plain text stays as is', 'plain text stays as is'],
    ['a\\nb', 'a\nb'],
    ['a\\tb\\rc', 'a\tb\rc'],
    ['\\a\\v\\b\\f', '\x07\x0b\b\f'],
    ['back\\\\slash', 'back\\slash'],
    ['say \\"hi\\"', 'say "hi"'],
    ["it\\'s", "it's"],
    ['\\x41\\x4a\\x4A', 'AJJ'],
    ['\\x4', '\x04'],
    ['\\x414', 'A4'],
    ['\\xZ', 'xZ'],
    ['\\101\\102', 'AB'],
    ['\\0', '\0'],
    ['\\18', '\x018'],
    ['\\400', '\0'],
    ['\\d+', 'd+'],
    ['\\\\d+', '\\d+'],
    ['trailing\\', 'trailing\\'],
    ['', ''],
])('stripcslashes(%j) -> %j', (input, expected) => {
    expect(stripcslashes(input)).toBe(expected);
});
