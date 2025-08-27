
export default class SerializedParsedExpression {
    constructor(expression, nodes) {
        this.expression = expression;
        this.nodes = nodes;
    }

    getNodes = () => {
        return JSON.parse(this.nodes);
    }

}