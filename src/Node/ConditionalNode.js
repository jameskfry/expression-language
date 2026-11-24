import Node from "./Node";
import {getSemantics} from "../Semantics";

export default class ConditionalNode extends Node {
    /**
     * @param {Node} expr1 The condition
     * @param {Node} expr2 The value when it is true
     * @param {Node} expr3 The value when it is false
     * @param {'symfony'|'js'|'portable'} semantics The rules deciding whether the condition is true (symfony: the default)
     */
    constructor(expr1, expr2, expr3, semantics = 'symfony') {
        super({
            expr1: expr1, expr2: expr2, expr3: expr3
        });
        if ('symfony' !== semantics) {
            this.attributes.semantics = semantics;
        }
        this.name = 'ConditionalNode';
    }

    compile = (compiler) => {
        const semantics = this.attributes.semantics ?? 'symfony';

        compiler.raw('(');
        if ('js' === semantics) {
            compiler.raw('(').compile(this.nodes.expr1).raw(')');
        }
        else {
            compiler.raw(`__runtime.${semantics}.truthy(`).compile(this.nodes.expr1).raw(')');
        }
        compiler.raw(' ? (')
            .compile(this.nodes.expr2)
            .raw(') : (')
            .compile(this.nodes.expr3)
            .raw('))');
    };

    evaluate = (functions, values) => {
        if (getSemantics(this.attributes.semantics).truthy(this.nodes.expr1.evaluate(functions, values))) {
            return this.nodes.expr2.evaluate(functions, values);
        }

        return this.nodes.expr3.evaluate(functions, values);
    };

    evaluateAsync = async (functions, values) => {
        const condNode = this.nodes.expr1;
        const condRaw = condNode.evaluateAsync ? await condNode.evaluateAsync(functions, values) : condNode.evaluate(functions, values);
        if (getSemantics(this.attributes.semantics).truthy(await condRaw)) {
            const trueNode = this.nodes.expr2;
            const trueRaw = trueNode.evaluateAsync ? await trueNode.evaluateAsync(functions, values) : trueNode.evaluate(functions, values);
            return await trueRaw;
        }

        const falseNode = this.nodes.expr3;
        const falseRaw = falseNode.evaluateAsync ? await falseNode.evaluateAsync(functions, values) : falseNode.evaluate(functions, values);
        return await falseRaw;
    };

    toArray = () => {
        return ['(', this.nodes.expr1, ' ? ', this.nodes.expr2, ' : ', this.nodes.expr3, ')'];
    };
}
