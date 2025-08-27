import Node from "./Node";
import {range} from "../lib/range";

export default class BinaryNode extends Node {

    static regex_expression = /\/(.+)\/(.*)/;

    static operators = {
        '~': '.',
        'and': '&&',
        'or': '||',
        'xor': 'xor',
        '<<': '<<',
        '>>': '>>'
    };

    static functions = {
        '**': 'Math.pow',
        '..': 'range',
        'in': 'includes',
        'not in': '!includes'
    };

    constructor(operator, left, right) {
        super({left: left, right: right}, {operator: operator});
        this.name = "BinaryNode";
    }

    compile = (compiler) => {
        let operator = this.attributes.operator;

        if ('matches' === operator) {
            compiler.compile(this.nodes.right)
                .raw(".test(")
                .compile(this.nodes.left)
                .raw(")");
            return;
        } else if ('contains' === operator) {
            compiler.raw('(')
                .compile(this.nodes.left)
                .raw(".toString().toLowerCase().includes(")
                .compile(this.nodes.right)
                .raw(".toString().toLowerCase())");

            return;
        } else if ('starts with' === operator) {
            compiler.raw('(')
                .compile(this.nodes.left)
                .raw(".toString().toLowerCase().startsWith(")
                .compile(this.nodes.right)
                .raw(".toString().toLowerCase())");

            return;
        } else if ('ends with' === operator) {
            compiler.raw('(')
                .compile(this.nodes.left)
                .raw(".toString().toLowerCase().endsWith(")
                .compile(this.nodes.right)
                .raw(".toString().toLowerCase())");

            return;
        }

        if (BinaryNode.functions[operator] !== undefined) {
            compiler.raw(`${BinaryNode.functions[operator]}(`)
                .compile(this.nodes.left)
                .raw(", ")
                .compile(this.nodes.right)
                .raw(")");

            return
        }

        if (BinaryNode.operators[operator] !== undefined) {
            operator = BinaryNode.operators[operator];
        }

        compiler.raw("(")
            .compile(this.nodes.left)
            .raw(' ')
            .raw(operator)
            .raw(' ')
            .compile(this.nodes.right)
            .raw(")");
    };

    evaluate = (functions, values) => {
        let operator = this.attributes.operator,
            left = this.nodes.left.evaluate(functions, values);

        //console.log("Evaluating: ", left, operator, right);

        if (BinaryNode.functions[operator] !== undefined) {
            let right = this.nodes.right.evaluate(functions, values);
            switch(operator) {
                case 'not in':
                    return right.indexOf(left) === -1;
                case 'in':
                    return right.indexOf(left) >= 0;
                case '..':
                    return range(left, right);
                case '**':
                    return Math.pow(left, right);
            }
        }

        let right = null;
        switch(operator) {
            case 'or':
            case '||':
                if (!left) {
                    right = this.nodes.right.evaluate(functions, values);
                }
                return left || right;
            case 'and':
            case '&&':
                if (left) {
                    right = this.nodes.right.evaluate(functions, values);
                }
                return left && right;
            case 'xor':
                right = this.nodes.right.evaluate(functions, values);
                return ((right && !left) || (left && !right));
            case '<<':
                right = this.nodes.right.evaluate(functions, values);
                return left << right;
            case '>>':
                right = this.nodes.right.evaluate(functions, values);
                return left >> right;
            default:
        }

        right = this.nodes.right.evaluate(functions, values);

        switch(operator) {
            case '|':
                return left | right;
            case '^':
                return left ^ right;
            case '&':
                return left & right;
            case '==':
                return left == right;
            case '===':
                return left === right;
            case '!=':
                return left != right;
            case '!==':
                return left !== right;
            case '<':
                return left < right;
            case '>':
                return left > right;
            case '>=':
                return left >= right;
            case '<=':
                return left <= right;
            case 'not in':
                return right.indexOf(left) === -1;
            case 'in':
                return right.indexOf(left) >= 0;
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '~':
                return left.toString() + right.toString();
            case '*':
                return left * right;
            case '/':
                return left / right;
            case '%':
                return left % right;
            case 'matches':
                if (left === null || left === undefined) {
                    return false;
                }
                let res = right.match(BinaryNode.regex_expression);
                let regexp = new RegExp(res[1], res[2]);
                return regexp.test(left);
            case 'contains':
                return left.toString().toLowerCase().includes(right.toString().toLowerCase());
            case 'starts with':
                return left.toString().toLowerCase().startsWith(right.toString().toLowerCase());
            case 'ends with':
                return left.toString().toLowerCase().endsWith(right.toString().toLowerCase());
        }
    };

    toArray() {
        return ["(", this.nodes.left, ' ' + this.attributes.operator + ' ', this.nodes.right, ")"];
    }

}