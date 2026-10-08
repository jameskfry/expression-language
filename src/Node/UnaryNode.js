import Node from "./Node";
import {getSemantics} from "../Semantics";

export default class UnaryNode extends Node {
    static operators = {
        '!': '!',
        'not': '!',
        '+': '+',
        '-': '-',
        '~': '~'
    };

    // names of the operations of the semantics (see src/Semantics)
    static operations = {
        '-': 'neg',
        '+': 'plus',
        '~': 'bitNot'
    };

    /**
     * @param {string} operator
     * @param {Node} node
     * @param {'symfony'|'js'|'portable'} semantics The rules the operator follows (symfony: the default)
     */
    constructor(operator, node, semantics = 'symfony') {
        super({node: node}, {operator: operator});
        if ('symfony' !== semantics) {
            this.attributes.semantics = semantics;
        }
        this.name = 'UnaryNode';
    }

    compile = (compiler) => {
        const semantics = this.attributes.semantics ?? 'symfony';
        const operator = this.attributes.operator;

        if ('js' !== semantics) {
            const runtime = `__runtime.${semantics}`;
            if ('not' === operator || '!' === operator) {
                compiler.raw(`(!${runtime}.truthy(`).compile(this.nodes.node).raw('))');
            }
            else if ('+' === operator) {
                compiler.raw('(').compile(this.nodes.node).raw(')');
            }
            else {
                compiler.raw(`${runtime}.${UnaryNode.operations[operator]}(`).compile(this.nodes.node).raw(')');
            }

            return;
        }

        compiler.raw('(')
            .raw(UnaryNode.operators[operator])
            .compile(this.nodes.node)
            .raw(')');
    };

    evaluate = (functions, values) => {
        const ops = getSemantics(this.attributes.semantics);
        const value = this.nodes.node.evaluate(functions, values);
        switch(this.attributes.operator) {
            case 'not':
            case '!':
                return !ops.truthy(value);
            case '-':
                return ops.neg(value);
            case '~':
                return ops.bitNot(value);
        }

        return ops.plus(value);
    };

    toArray = () => {
        return ['(', this.attributes.operator + " ", this.nodes.node, ')'];
    }
}
