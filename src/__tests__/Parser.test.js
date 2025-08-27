import {tokenize} from "../Lexer";
import Parser, {IGNORE_UNKNOWN_FUNCTIONS, IGNORE_UNKNOWN_VARIABLES} from "../Parser";
import ArgumentsNode from "../Node/ArgumentsNode";
import ConstantNode from "../Node/ConstantNode";
import NameNode from "../Node/NameNode";
import UnaryNode from "../Node/UnaryNode";
import BinaryNode from "../Node/BinaryNode";
import GetAttrNode from "../Node/GetAttrNode";
import ConditionalNode from "../Node/ConditionalNode";
import NullCoalesceNode from "../Node/NullCoalesceNode";
import ArrayNode from "../Node/ArrayNode";

function getParseData() {
    let args = new ArgumentsNode();
    args.addElement(new ConstantNode('arg1'));
    args.addElement(new ConstantNode(2));
    args.addElement(new ConstantNode(true));

    let arrayNode = new ArrayNode();
    arrayNode.addElement(new NameNode('bar'));

    return [
        [new NameNode('a'), 'a', ['a']],
        [new ConstantNode('a'), '"a"'],
        [new ConstantNode(3), '3'],
        [new ConstantNode(false), 'false'],
        [new ConstantNode(true), 'true'],
        [new ConstantNode(null), 'null'],
        [new UnaryNode('-', new ConstantNode(3)), '-3'],
        [new BinaryNode('-', new ConstantNode(3), new ConstantNode(3)), '3 - 3'],
        [new BinaryNode(
            '*',
            new BinaryNode('-', new ConstantNode(3), new ConstantNode(3)),
            new ConstantNode(2)
        ),
            '(3 - 3) * 2'
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL),
            'foo.bar',
            ['foo']
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL),
            'foo.bar()',
            ['foo']
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('not', true), new ArgumentsNode(), GetAttrNode.METHOD_CALL),
            'foo.not()',
            ['foo']
        ],
        [
            new GetAttrNode(
                new NameNode('foo'),
                new ConstantNode('bar', true),
                args,
                GetAttrNode.METHOD_CALL
            ),
            'foo.bar("arg1", 2, true)',
            ['foo']
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode(3), new ArgumentsNode(), GetAttrNode.ARRAY_CALL),
            'foo[3]',
            ['foo']
        ],
        [
            new ConditionalNode(new ConstantNode(true), new ConstantNode(true), new ConstantNode(false)),
            'true ? true ? false'
        ],
        [
            new BinaryNode('matches', new ConstantNode('foo'), new ConstantNode('/foo/')),
            '"foo" matches "/foo/"'
        ],
        [
            new BinaryNode('contains', new ConstantNode('foo'), new ConstantNode('fo')),
            '"foo" contains "fo"'
        ],
        [
            new BinaryNode('starts with', new ConstantNode('foo'), new ConstantNode('fo')),
            '"foo" starts with "fo"'
        ],
        [
            new BinaryNode('ends with', new ConstantNode('foo'), new ConstantNode('oo')),
            '"foo" ends with "oo"'
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true, true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL),
            "foo?.bar",
            ['foo']
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true, true), new ArgumentsNode(), GetAttrNode.METHOD_CALL),
            "foo?.bar()",
            ['foo']
        ],
        [
            new GetAttrNode(new NameNode('foo'), new ConstantNode('not', true, true), new ArgumentsNode(), GetAttrNode.METHOD_CALL),
            "foo?.not()",
            ['foo']
        ],
        [
            new NullCoalesceNode(new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL), new ConstantNode('default')),
            'foo.bar ?? "default"',
            ['foo']
        ],
        [
            new NullCoalesceNode(new GetAttrNode(new NameNode('foo'), new ConstantNode('bar', true), new ArgumentsNode(), GetAttrNode.ARRAY_CALL), new ConstantNode('default')),
            'foo["bar"] ?? "default"',
            ['foo']
        ],
        // chained calls
        [
            createGetAttrNode(
                createGetAttrNode(
                    createGetAttrNode(
                        createGetAttrNode(new NameNode('foo'), 'bar', GetAttrNode.METHOD_CALL),
                        'foo', GetAttrNode.METHOD_CALL
                    ),
                    'baz', GetAttrNode.PROPERTY_CALL
                ),
                '3', GetAttrNode.ARRAY_CALL
            ),
            'foo.bar().foo().baz[3]',
            ['foo']
        ],

        [
            new NameNode('foo'),
            'bar',
            [{foo: 'bar'}]
        ],

        // Operators collisions
        [
            new BinaryNode(
                'in',
                new GetAttrNode(
                    new NameNode('foo'),
                    new ConstantNode('not', true),
                    new ArgumentsNode(),
                    GetAttrNode.PROPERTY_CALL
                ),
                arrayNode
            ),
            'foo.not in [bar]',
            ['foo', 'bar'],
        ],
        [
            new BinaryNode(
                'or',
                new UnaryNode('not', new NameNode('foo')),
                new GetAttrNode(
                    new NameNode('foo'),
                    new ConstantNode('not', true),
                    new ArgumentsNode(),
                    GetAttrNode.PROPERTY_CALL
                )
            ),
            'not foo or foo.not',
            ['foo'],
        ],
        [
            new BinaryNode(
                'xor',
                new NameNode('foo'),
                new NameNode('bar'),
            ),
            'foo xor bar',
            ['foo', 'bar'],
        ],
        [
            new BinaryNode('..', new ConstantNode(0), new ConstantNode(3)),
            '0..3',
        ],
        [
            new BinaryNode('+', new ConstantNode(0), new ConstantNode(0.1)),
            '0+.1',
        ],
    ];
}

function getLintData() {
    // Keys are kept as descriptive strings; values are objects with expression, names, optional checks and exception
    return {
        'valid expression': {
            expression: 'foo["some_key"].callFunction(a ? b)',
            names: ['foo', 'a', 'b'],
        },
        'valid expression with null safety': {
            expression: 'foo["some_key"]?.callFunction(a ? b)',
            names: ['foo', 'a', 'b'],
        },
        'allow expression with unknown names': {
            expression: 'foo.bar',
            names: [],
            checks: IGNORE_UNKNOWN_VARIABLES,
        },
        'allow expression with unknown functions': {
            expression: 'foo()',
            names: [],
            checks: IGNORE_UNKNOWN_FUNCTIONS,
        },
        'allow expression with unknown functions and names': {
            expression: 'foo(bar)',
            names: [],
            checks: IGNORE_UNKNOWN_FUNCTIONS | IGNORE_UNKNOWN_VARIABLES,
        },
        'array with trailing comma': {
            expression: '[value1, value2, value3,]',
            names: ['value1', 'value2', 'value3'],
        },
        'hashmap with trailing comma': {
            expression: '{val1: value1, val2: value2, val3: value3,}',
            names: ['value1', 'value2', 'value3'],
        },
        'disallow expression with unknown names by default': {
            expression: 'foo.bar',
            names: [],
            checks: 0,
            exception: 'Variable "foo" is not valid around position 1 for expression `foo.bar',
        },
        'disallow expression with unknown functions by default': {
            expression: 'foo()',
            names: [],
            checks: 0,
            exception: 'The function "foo" does not exist around position 1 for expression `foo()',
        },
        'operator collisions': {
            expression: 'foo.not in [bar]',
            names: ['foo', 'bar'],
        },
        'incorrect expression ending': {
            expression: 'foo["a"] foo["b"]',
            names: ['foo'],
            checks: 0,
            exception: 'Unexpected token "name" of value "foo" around position 10 for expression `foo["a"] foo["b"]`.',
        },
        'incorrect operator': {
            expression: 'foo["some_key"] // 2',
            names: ['foo'],
            checks: 0,
            exception: 'Unexpected token "operator" of value "/" around position 18 for expression `foo["some_key"] // 2`.',
        },
        'incorrect array': {
            expression: '[value1, value2 value3]',
            names: ['value1', 'value2', 'value3'],
            checks: 0,
            exception: 'An array element must be followed by a comma. Unexpected token "name" of value "value3" ("punctuation" expected with value ",") around position 17 for expression `[value1, value2 value3]`.',
        },
        'incorrect array element': {
            expression: 'foo["some_key")',
            names: ['foo'],
            checks: 0,
            exception: 'Unclosed "[" around position 3 for expression `foo["some_key")`.',
        },
        'incorrect hash key': {
            expression: '{+: value1}',
            names: ['value1'],
            checks: 0,
            exception: 'A hash key must be a quoted string, a number, a name, or an expression enclosed in parentheses (unexpected token "operator" of value "+" around position 2 for expression `{+: value1}`.',
        },
        'missed array key': {
            expression: 'foo[]',
            names: ['foo'],
            checks: 0,
            exception: 'Unexpected token "punctuation" of value "]" around position 5 for expression `foo[]`.',
        },
        'missed closing bracket in sub expression': {
            expression: 'foo[(bar ? bar : "default"]',
            names: ['foo', 'bar'],
            checks: 0,
            exception: 'Unclosed "(" around position 4 for expression `foo[(bar ? bar : "default"]`.',
        },
        'incorrect hash following': {
            expression: '{key: foo key2: bar}',
            names: ['foo', 'bar'],
            checks: 0,
            exception: 'A hash value must be followed by a comma. Unexpected token "name" of value "key2" ("punctuation" expected with value ",") around position 11 for expression `{key: foo key2: bar}`.',
        },
        'incorrect hash assign': {
            expression: '{key => foo}',
            names: ['foo'],
            checks: 0,
            exception: 'Unexpected character "=" around position 5 for expression `{key => foo}`.',
        },
        'incorrect array as hash using': {
            expression: '[foo: foo]',
            names: ['foo'],
            checks: 0,
            exception: 'An array element must be followed by a comma. Unexpected token "punctuation" of value ":" ("punctuation" expected with value ",") around position 5 for expression `[foo: foo]`.',
        },
    };
}

function createGetAttrNode(node, item, type) {
    return new GetAttrNode(node, new ConstantNode(item, GetAttrNode.ARRAY_CALL !== type), new ArgumentsNode(), type);
}

function getInvalidPostfixData() {
    return [
        ['foo."#"', ['foo']],
        ['foo."bar"', ['foo']],
        ['foo.**', ['foo']],
        ['foo.123', ['foo']]
    ]
}

test("parse with invalid name", () => {
    try {
        let parser = new Parser();
        parser.parse(tokenize("foo"));
        console.log("The parser should throw an error.");
        expect(true).toBe(false); // This should fail
    } catch (err) {
        expect(err.toString()).toContain('Variable "foo" is not valid around position 1');
    }
});

test("parse with zero in names", () => {
    try {
        let parser = new Parser();
        parser.parse(tokenize("foo"), [0]);
        console.log("The parser should throw an error.");
        expect(true).toBe(false); // This should fail
    } catch (err) {
        expect(err.toString()).toContain('Variable "foo" is not valid around position 1');
    }
});

test("parse primary expression with unknown function throws", () => {
    try {
        let parser = new Parser();
        parser.parse(tokenize("foo()"));
        console.log("The parser should throw an error.");
        expect(true).toBe(false);
    } catch (err) {
        expect(err.toString()).toContain('The function "foo" does not exist around position 1');
    }
});

test('parse with invalid postfix data', () => {
    let invalidPostfixData = getInvalidPostfixData();
    for (let oneTest of invalidPostfixData) {
        try {
            let parser = new Parser();
            parser.parse(tokenize(oneTest[0]), oneTest[1]);
            console.log("The parser should throw an error.");
            expect(true).toBe(false); // This should fail
        } catch (err) {
            expect(err.name).toBe('SyntaxError');
        }
    }
});

test('name proposal', () => {
    try {
        let parser = new Parser();
        parser.parse(tokenize('foo > bar'), ['foo', 'baz']);
        console.log("The parser should throw an error.");
        expect(true).toBe(false); // This should fail
    } catch (err) {
        expect(err.toString()).toContain('Did you mean "baz"?');
    }
});

test('lint', () => {
    let lintData = getLintData();
    for (let testKey in lintData) {
        let testData = lintData[testKey];
        if (testData.exception) {
            try {
                let parser = new Parser();
                parser.parse(tokenize(testData.expression), testData.names, testData.checks ?? 0);
                console.log("The parser should throw an error.");
                expect(true).toBe(false);
            }
            catch(err) {
                expect(err.toString()).toContain(testData.exception);
            }
        }
        else {
            let parser = new Parser();
            parser.parse(tokenize(testData.expression), testData.names, testData.checks ?? 0);
        }
    }
})

test('parse', () => {
    let parseData = getParseData();
    for (let parseDatum of parseData) {
        //console.log("Testing ", parseDatum[1], parseDatum[2]);

        let parser = new Parser();
        let generated = parser.parse(tokenize(parseDatum[1]), parseDatum[2]);
        expect(generated.toString()).toBe(parseDatum[0].toString());
    }
});