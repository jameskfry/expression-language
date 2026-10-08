import Node from "./Node";
import GetAttrNode from "./GetAttrNode";

export default class NullCoalesceNode extends Node {
    constructor(expr1, expr2) {
        super({expr1: expr1, expr2: expr2});
        this.name = 'NullCoalesceNode';

        // Every access of the chain on the left must tolerate a missing link, both when evaluated and when compiled
        this._addNullCoalesceAttributeToGetAttrNodes(expr1);
    }

    compile = (compiler) => {
        compiler.raw('((')
            .compile(this.nodes.expr1)
            .raw(") ?? (")
            .compile(this.nodes.expr2)
            .raw("))");
    }

    evaluate = (functions, values) => {
        return this.nodes.expr1.evaluate(functions, values) ?? this.nodes.expr2.evaluate(functions, values);
    }

    toArray = () => {
        return ['(', this.nodes.expr1, ') ?? (', this.nodes.expr2, ')'];
    }

    _addNullCoalesceAttributeToGetAttrNodes = (node) => {
        if (!(node instanceof GetAttrNode)) {
            return;
        }

        node.attributes.is_null_coalesce = true;
        for (let oneNode of Object.values(node.nodes)) {
            this._addNullCoalesceAttributeToGetAttrNodes(oneNode)
        }
    }
}
