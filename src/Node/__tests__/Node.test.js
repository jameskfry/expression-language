import Node from "../Node";
import ConstantNode from "../ConstantNode";

test("toString", () => {
    let node = new Node([new ConstantNode('foo')]);
    expect(node.toString()).toBe("Node(\n    ConstantNode(value: 'foo')\n)");
});