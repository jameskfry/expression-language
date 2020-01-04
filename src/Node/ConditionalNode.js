import Node from "./Node";

export default class ConditionalNode extends Node {
    constructor(expr1, expr2, expr3) {
        super({
            expr1: expr1, expr2: expr2, expr3: expr3
        });
        this.name = 'ConditionalNode';
    }

    compile = (compiler) => {
        compiler.raw('((')
            .compile(this.nodes.expr1)
            .raw(') ? (')
            .compile(this.nodes.expr2)
            .raw(') : (')
            .compile(this.nodes.expr3)
            .raw('))');
    };

    evaluate = (functions, values) => {
        if (this.nodes.expr1.evaluate(functions, values)) {
            return this.nodes.expr2.evaluate(functions, values);
        }

        return this.nodes.expr3.evaluate(functions, values);
    };

    toArray() {
        return ['(', this.nodes.expr1, ' ? ', this.nodes.expr2, ' : ', this.nodes.expr3, ')'];
    };
}