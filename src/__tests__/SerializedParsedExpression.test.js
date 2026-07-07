import SerializedParsedExpression from "../SerializedParsedExpression";

test('constructor stores the expression and serialized nodes', () => {
    let serialized = new SerializedParsedExpression('25 + 30', '{"name":"BinaryNode"}');

    expect(serialized.expression).toBe('25 + 30');
    expect(serialized.nodes).toBe('{"name":"BinaryNode"}');
});

test('getNodes parses the serialized JSON nodes', () => {
    let serialized = new SerializedParsedExpression('25', JSON.stringify({name: 'ConstantNode', attributes: {value: 25}}));

    expect(serialized.getNodes()).toEqual({name: 'ConstantNode', attributes: {value: 25}});
});

test('getNodes throws on invalid JSON', () => {
    let serialized = new SerializedParsedExpression('25', 'not valid json');

    expect(() => serialized.getNodes()).toThrow();
});
