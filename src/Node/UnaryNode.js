import Node from "./Node";

export default class UnaryNode extends Node {
    static operators = {
        '!': '!',
        'not': '!',
        '+': '+',
        '-': '-'
    };

    constructor(operator, node) {
        super({node: node}, {operator: operator});
        this.name = 'UnaryNode';
    }

    compile = (compiler) => {
        compiler.raw('(')
            .raw(UnaryNode.operators[this.attributes.operator])
            .compile(this.nodes.node)
            .raw(')');
    };

    evaluate = (functions, values) => {
        let value = this.nodes.node.evaluate(functions, values);
        switch(this.attributes.operator) {
            case 'not':
            case '!':
                return !value;
            case '-':
                return -value;
        }

        return value;
    };

    toArray() {
        return ['(', this.attributes.operator + " ", this.nodes.node, ')'];
    }
}