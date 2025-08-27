import Node from "./Node";
import GetAttrNode from "./GetAttrNode";

export default class NullCoalesceNode extends Node {
    constructor(expr1, expr2) {
        super({expr1: expr1, expr2: expr2});
        this.name = 'NullCoalesceNode';
    }

    compile = (compiler) => {
        compiler.raw('((')
            .compile(this.nodes.expr1)
            .raw(") ?? (")
            .compile(this.nodes.expr2)
            .raw("))");
    }

    evaluate = (functions, values) => {
        if (this.nodes.expr1 instanceof GetAttrNode) {
            this._addNullCoalesceAttributeToGetAttrNodes(this.nodes.expr1);
        }

        return this.nodes.expr1.evaluate(functions, values) ?? this.nodes.expr2.evaluate(functions, values);
    }

    toArray = () => {
        return ['(', this.nodes.expr1, ') ?? (', this.nodes.expr2, ')'];
    }

    _addNullCoalesceAttributeToGetAttrNodes = (node) => {
        if (!node instanceof GetAttrNode) {
            return;
        }

        node.attributes.is_null_coalesce = true;
        for (let oneNode of Object.values(node.nodes)) {
            this._addNullCoalesceAttributeToGetAttrNodes(oneNode)
        }
    }
}