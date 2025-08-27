import Node from "../Node";
import ConstantNode from "../ConstantNode";
import Compiler from "../../Compiler";

test("toString", () => {
    let node = new Node([new ConstantNode('foo')]);
    expect(node.toString()).toBe("Node(\n    ConstantNode(value: 'foo')\n)");
});

test("serialization", () => {
    let node = new Node({foo: 'bar'}, {bar: 'foo'});
    let serialized = JSON.stringify(node);
    let unserialized = Object.assign(new Node, JSON.parse(serialized));
    expect(unserialized).toBeInstanceOf(Node);
    expect(unserialized.toString()).toEqual(node.toString());
});

test('compileActuallyCompilesAllNodes', () => {
    const compiler = new Compiler({});
    const nodes = [];
    for (let i = 0; i < 10; i++) {
        nodes.push({
            compile: jest.fn(),
            toString: () => 'MockNode()'
        });
    }
    const parent = new Node(nodes);
    parent.compile(compiler);
    for (const child of nodes) {
        expect(child.compile).toHaveBeenCalledTimes(1);
        expect(child.compile).toHaveBeenCalledWith(compiler);
    }
});

test('evaluateActuallyEvaluatesAllNodes', () => {
    const nodes = [];
    for (let i = 1; i <= 3; i++) {
        nodes.push({
            evaluate: jest.fn().mockReturnValue(i),
            toString: () => 'MockNode()'
        });
    }
    const parent = new Node(nodes);
    const functions = {};
    const values = {};
    const result = parent.evaluate(functions, values);
    expect(result).toEqual([1, 2, 3]);
    for (const child of nodes) {
        expect(child.evaluate).toHaveBeenCalledTimes(1);
        expect(child.evaluate).toHaveBeenCalledWith(functions, values);
    }
});
