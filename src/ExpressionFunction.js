export default class ExpressionFunction {
    constructor(name, compiler, evaluator) {
        this.name = name;
        this.compiler = compiler;
        this.evaluator = evaluator;
    }

    getName = () => {
        return this.name;
    };

    getCompiler = () => {
        return this.compiler;
    };

    getEvaluator = () => {
        return this.evaluator;
    }

    // TODO not sure how to check if function exists in javascript
    // fromJavascript(javascriptFunctionName, expressionFunctionName = null) {}
}
