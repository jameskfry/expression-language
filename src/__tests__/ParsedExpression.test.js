import ConstantNode from "../Node/ConstantNode";
import ParsedExpression from "../ParsedExpression";
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
    expect(unserialized.nodes.length).toEqual(expression.nodes.length);
    for (let i = 0; i < unserialized.nodes.length; i++) {
        expect(unserialized.nodes[i]).toEqual(nodes[i]);
    }
});