import ConstantNode from "../Node/ConstantNode";
import Node from "../Node/Node";
import GetAttrNode from "../Node/GetAttrNode";
import ParsedExpression from "../ParsedExpression";
import ExpressionLanguage from "../ExpressionLanguage";
import {Parser, tokenize} from "../index";

test('serialize ParsedExpression', () => {
    let expression = new ParsedExpression('25', new ConstantNode(25));

    let serialized = JSON.stringify(expression);
    let unserialized = ParsedExpression.fromJSON(serialized);

    expect(unserialized.expression).toEqual(expression.expression);
    expect(unserialized.nodes.name).toEqual(expression.nodes.name);
    expect(unserialized.nodes.attributes).toMatchObject(expression.nodes.attributes);
});

test('serialize more complex ParsedExpression', () => {
    let expressionString = "25 + 30";
    let parser = new Parser();
    let nodes = parser.parse(tokenize(expressionString));
    let expression = new ParsedExpression(expressionString, nodes);

    let serialized = JSON.stringify(expression);
    let unserialized = ParsedExpression.fromJSON(serialized);
    expect(unserialized.expression).toEqual(expressionString);
    expect(unserialized.nodes.name).toEqual(nodes.name);
    expect(unserialized.nodes.attributes).toMatchObject(nodes.attributes);
});

/**
 * Round-trips `expressionString` through parse -> JSON.stringify -> fromJSON, then asserts
 * that the deserialized tree evaluates and compiles identically to the original. This avoids
 * brittle deep-equality on Node instances, whose class-field methods are separate closures
 * per instance and would never be reference-equal across the original/restored trees.
 */
function expectRoundTrips(el, expressionString, values = {}) {
    let names = Object.keys(values);
    let parsed = el.parse(expressionString, names);
    let originalResult = el.evaluate(parsed, values);
    let originalCompiled = el.compile(parsed, names);

    let restored = ParsedExpression.fromJSON(JSON.stringify(parsed));
    expect(restored).toBeInstanceOf(ParsedExpression);
    expect(restored.expression).toBe(expressionString);

    let restoredResult = el.evaluate(restored, values);
    let restoredCompiled = el.compile(restored, names);

    expect(restoredResult).toEqual(originalResult);
    expect(restoredCompiled).toEqual(originalCompiled);

    return {parsed, restored};
}

test('fromJSON round-trips a NameNode', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo', {foo: 42});
});

test('fromJSON round-trips ConstantNode string/number/boolean/null values', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, '"hello"');
    expectRoundTrips(el, '42');
    expectRoundTrips(el, 'true');
    expectRoundTrips(el, 'false');
    expectRoundTrips(el, 'null');
});

test('fromJSON round-trips a UnaryNode', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, '-foo', {foo: 5});
    expectRoundTrips(el, '!foo', {foo: true});
});

test('fromJSON round-trips a BinaryNode', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo + bar', {foo: 10, bar: 5});
});

test('fromJSON round-trips a ConditionalNode', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo ? bar : baz', {foo: true, bar: 1, baz: 2});
    expectRoundTrips(el, 'foo ? bar : baz', {foo: false, bar: 1, baz: 2});
});

test('fromJSON round-trips a NullCoalesceNode', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo ?? bar', {foo: null, bar: 'default'});
    expectRoundTrips(el, 'foo ?? bar', {foo: 'set', bar: 'default'});
});

test('fromJSON round-trips a NullCoalescedNameNode for an undeclared variable', () => {
    let parser = new Parser();
    let expressionString = 'undeclared ?? "fallback"';
    let nodes = parser.parse(tokenize(expressionString), []);
    let parsed = new ParsedExpression(expressionString, nodes);

    let restored = ParsedExpression.fromJSON(JSON.stringify(parsed));
    expect(restored.getNodes().nodes.expr1.name).toBe('NullCoalescedNameNode');
    expect(restored.getNodes().evaluate({}, {})).toBe('fallback');
});

test('fromJSON round-trips a FunctionNode with multiple ArgumentsNode arguments (regression: fnArguments key)', () => {
    let el = new ExpressionLanguage();
    let {restored} = expectRoundTrips(el, 'min(foo, bar, 3)', {foo: 10, bar: 5});

    // Directly assert the restored FunctionNode's argument list actually reconstructed
    // (this is the exact shape that was broken by the n.nodes.arguments/fnArguments key mismatch).
    let fnNode = restored.getNodes();
    expect(fnNode.name).toBe('FunctionNode');
    expect(fnNode.nodes.fnArguments).toBeDefined();
    expect(fnNode.nodes.fnArguments.nodes.length).toBe(3);
});

test('fromJSON round-trips an ArrayNode (array literal)', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, '[1, 2, foo]', {foo: 3});
});

test('fromJSON round-trips an ArrayNode (hash/object literal)', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, '{x: 1, y: foo}', {foo: 2});
});

test('fromJSON round-trips a GetAttrNode property call', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo.bar', {foo: {bar: 'baz'}});
});

test('fromJSON round-trips a GetAttrNode method call with no arguments', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo.bar()', {foo: {bar: () => 'called'}});
});

test('fromJSON round-trips a GetAttrNode method call with ArgumentsNode arguments', () => {
    let el = new ExpressionLanguage();
    let {restored} = expectRoundTrips(el, 'foo.bar(1, 2)', {foo: {bar: (a, b) => a + b}});

    let getAttr = restored.getNodes();
    expect(getAttr.nodes.fnArguments.name).toBe('ArgumentsNode');
    // ArgumentsNode stores interleaved key/value pairs, so 2 arguments -> 4 entries.
    expect(Object.keys(getAttr.nodes.fnArguments.nodes)).toHaveLength(4);
});

test('fromJSON round-trips a GetAttrNode array call', () => {
    let el = new ExpressionLanguage();
    expectRoundTrips(el, 'foo[1]', {foo: [10, 20, 30]});
});

test('fromJSON restores the is_null_coalesce flag on a nested GetAttrNode', () => {
    let el = new ExpressionLanguage();
    let values = {a: {}};
    let parsed = el.parse('a.foo ?? "default"', Object.keys(values));

    // Evaluating mutates the nested GetAttrNode's is_null_coalesce attribute in place.
    let originalResult = el.evaluate(parsed, values);
    expect(originalResult).toBe('default');

    let originalGetAttr = parsed.getNodes().nodes.expr1;
    expect(originalGetAttr.attributes.is_null_coalesce).toBe(true);

    let restored = ParsedExpression.fromJSON(JSON.stringify(parsed));
    let restoredGetAttr = restored.getNodes().nodes.expr1;

    expect(restoredGetAttr).toBeInstanceOf(GetAttrNode);
    expect(restoredGetAttr.attributes.is_null_coalesce).toBe(true);
    expect(restoredGetAttr.evaluate(el.functions, values)).toBeNull();
});

test('fromJSON restores the is_short_circuited flag and preserves short-circuit chaining', () => {
    let el = new ExpressionLanguage();
    let values = {a: null};
    let parsed = el.parse('a?.b.c', Object.keys(values));

    let originalResult = el.evaluate(parsed, values);
    expect(originalResult).toBeNull();

    let outerOriginal = parsed.getNodes();
    let innerOriginal = outerOriginal.nodes.node;
    expect(innerOriginal.attributes.is_short_circuited).toBe(true);

    let restored = ParsedExpression.fromJSON(JSON.stringify(parsed));
    let outerRestored = restored.getNodes();
    let innerRestored = outerRestored.nodes.node;

    expect(innerRestored).toBeInstanceOf(GetAttrNode);
    expect(innerRestored.attributes.is_short_circuited).toBe(true);
    expect(el.evaluate(restored, values)).toBeNull();
});

test('fromJSON accepts a plain object in addition to a JSON string', () => {
    let expression = new ParsedExpression('25', new ConstantNode(25));
    let plainObject = JSON.parse(JSON.stringify(expression));

    let restored = ParsedExpression.fromJSON(plainObject);
    expect(restored.expression).toBe('25');
    expect(restored.nodes.attributes.value).toBe(25);
});

test('fromJSON preserves a null or undefined nodes container', () => {
    expect(ParsedExpression.fromJSON({expression: 'x', nodes: null}).getNodes()).toBeNull();
    expect(ParsedExpression.fromJSON({expression: 'x'}).getNodes()).toBeUndefined();
});

test('fromJSON reconstructs a raw array of top-level nodes', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: [
            {name: 'ConstantNode', attributes: {value: 1}},
            {name: 'ConstantNode', attributes: {value: 2}}
        ]
    });

    let nodes = restored.getNodes();
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toBeInstanceOf(ConstantNode);
    expect(nodes[0].attributes.value).toBe(1);
    expect(nodes[1].attributes.value).toBe(2);
});

test('fromJSON reconstructs an object map of nodes without an outer name', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            left: {name: 'ConstantNode', attributes: {value: 1}},
            right: {name: 'ConstantNode', attributes: {value: 2}}
        }
    });

    let nodes = restored.getNodes();
    expect(nodes.left).toBeInstanceOf(ConstantNode);
    expect(nodes.left.attributes.value).toBe(1);
    expect(nodes.right.attributes.value).toBe(2);
});

test('fromJSON reconstructs a generic Node container (e.g. a raw argument list)', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'Node',
            nodes: [
                {name: 'ConstantNode', attributes: {value: 1}},
                {name: 'ConstantNode', attributes: {value: 2}}
            ],
            attributes: {}
        }
    });

    let container = restored.getNodes();
    expect(container).toBeInstanceOf(Node);
    expect(container.name).toBe('Node');
    expect(Array.isArray(container.nodes)).toBe(true);
    expect(container.nodes).toHaveLength(2);
});

test('fromJSON falls back to a generic Node for an unrecognized node name', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'MysteryNode',
            attributes: {foo: 'bar'},
            nodes: {
                0: {name: 'ConstantNode', attributes: {value: 1}}
            }
        }
    });

    let node = restored.getNodes();
    expect(node).toBeInstanceOf(Node);
    expect(node.name).toBe('MysteryNode');
    expect(node.attributes).toEqual({foo: 'bar'});
    expect(node.nodes['0']).toBeInstanceOf(ConstantNode);
});

test('fromJSON passes through values that are not node-shaped objects', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'ConstantNode',
            attributes: {value: {plain: 'object without a name'}}
        }
    });

    expect(restored.getNodes().attributes.value).toEqual({plain: 'object without a name'});
});

test('fromJSON falls back to a generic Node for an unrecognized node name with array-style children', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'MysteryNode',
            attributes: {},
            nodes: [
                {name: 'ConstantNode', attributes: {value: 1}},
                {name: 'ConstantNode', attributes: {value: 2}}
            ]
        }
    });

    let node = restored.getNodes();
    expect(Array.isArray(node.nodes)).toBe(true);
    expect(node.nodes).toHaveLength(2);
});

test('fromJSON reconstructs a generic Node container with object-style (non-array) children', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'Node',
            attributes: {},
            nodes: {
                left: {name: 'ConstantNode', attributes: {value: 1}}
            }
        }
    });

    let node = restored.getNodes();
    expect(node.nodes.left).toBeInstanceOf(ConstantNode);
    expect(node.nodes.left.attributes.value).toBe(1);
});

test('buildNode passes through a value that is already a Node instance', () => {
    let already = new ConstantNode(99);
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'UnaryNode',
            attributes: {operator: '-'},
            nodes: {node: already}
        }
    });

    expect(restored.getNodes().nodes.node).toBe(already);
});

test('buildNode passes through null/primitive entries found within a node map', () => {
    let restored = ParsedExpression.fromJSON({
        expression: 'x',
        nodes: {
            name: 'ArgumentsNode',
            type: 'Array',
            nodes: {
                '0': null,
                '1': 42,
                '2': {name: 'ConstantNode', attributes: {value: 1}}
            }
        }
    });

    let argsNode = restored.getNodes();
    expect(argsNode.nodes['0']).toBeNull();
    expect(argsNode.nodes['1']).toBe(42);
    expect(argsNode.nodes['2']).toBeInstanceOf(ConstantNode);
});

test('fromJSON preserves a primitive (non-node, non-array, non-object) nodes container', () => {
    let restored = ParsedExpression.fromJSON({expression: 'x', nodes: 'not-a-node'});

    expect(restored.getNodes()).toBe('not-a-node');
});
