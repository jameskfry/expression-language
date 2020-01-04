import Expression from "./Expression";

export default class ParsedExpression extends Expression {
    constructor(expression, nodes) {
        super(expression);
        this.nodes = nodes;
    }

    getNodes = () => {
        return this.nodes;
    }
}