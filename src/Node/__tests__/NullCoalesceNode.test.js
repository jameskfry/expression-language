import NullCoalesceNode from "../NullCoalesceNode";
import ConstantNode from "../ConstantNode";
import NameNode from "../NameNode";
import GetAttrNode from "../GetAttrNode";
import ArgumentsNode from "../ArgumentsNode";
import Compiler from "../../Compiler";

test('evaluate returns the left side when it is not null/undefined', () => {
    let node = new NullCoalesceNode(new ConstantNode('left'), new ConstantNode('right'));
    expect(node.evaluate({}, {})).toBe('left');
});

test('evaluate falls back to the right side when the left side is null', () => {
    let node = new NullCoalesceNode(new ConstantNode(null), new ConstantNode('right'));
    expect(node.evaluate({}, {})).toBe('right');
});

test('compile produces a JS nullish-coalescing expression', () => {
    let node = new NullCoalesceNode(new ConstantNode('left'), new ConstantNode('right'));
    let compiler = new Compiler({});
    node.compile(compiler);
    expect(compiler.getSource()).toBe('(("left") ?? ("right"))');
});

test('toArray/dump renders as a nullish-coalescing expression', () => {
    let node = new NullCoalesceNode(new ConstantNode('left'), new ConstantNode('right'));
    expect(node.dump()).toBe('("left") ?? ("right")');
});

test('evaluate marks a GetAttrNode left side (and its GetAttrNode descendants) as null-coalesced', () => {
    let inner = new GetAttrNode(new NameNode('a'), new ConstantNode('b', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);
    let outer = new GetAttrNode(inner, new ConstantNode('c', true), new ArgumentsNode(), GetAttrNode.PROPERTY_CALL);
    let node = new NullCoalesceNode(outer, new ConstantNode('default'));

    expect(outer.attributes.is_null_coalesce).toBe(false);
    expect(inner.attributes.is_null_coalesce).toBe(false);

    node.evaluate({}, {a: {}});

    expect(outer.attributes.is_null_coalesce).toBe(true);
    expect(inner.attributes.is_null_coalesce).toBe(true);
});

test('evaluate leaves a non-GetAttrNode left side untouched (no recursive marking)', () => {
    let node = new NullCoalesceNode(new ConstantNode(null), new ConstantNode('right'));
    expect(() => node.evaluate({}, {})).not.toThrow();
});
