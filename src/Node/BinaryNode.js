import Node from "./Node";
import ConstantNode from "./ConstantNode";
import {matches, toRegExp} from "../lib/pregPattern";
import SyntaxError from "../SyntaxError";
import {getSemantics} from "../Semantics";

// names of the operations of the semantics (see src/Semantics)
const OPERATIONS = {
    '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '**': 'pow',
    '&': 'bitAnd', '|': 'bitOr', '^': 'bitXor', '<<': 'shl', '>>': 'shr',
    '==': 'eq', '!=': 'ne', '===': 'identical', '!==': 'notIdentical', '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge',
    '~': 'concat', '..': 'range', 'in': 'inArray', 'not in': 'notInArray',
    'contains': 'contains', 'starts with': 'startsWith', 'ends with': 'endsWith',
};

const STRING_OPERATORS = {
    'contains': 'includes',
    'starts with': 'startsWith',
    'ends with': 'endsWith',
};

export default class BinaryNode extends Node {

    /**
     * @param {string} operator
     * @param {Node} left
     * @param {Node} right
     * @param {boolean} caseInsensitive Only meaningful for `contains`, `starts with` and `ends with`
     * @param {'symfony'|'js'|'portable'} semantics The rules the operator follows (symfony: the default), see src/Semantics
     */
    constructor(operator, left, right, caseInsensitive = false, semantics = 'symfony') {
        super({left: left, right: right}, {operator: operator});
        if (caseInsensitive && STRING_OPERATORS[operator] !== undefined) {
            this.attributes.case_insensitive = true;
        }
        if ('symfony' !== semantics) {
            this.attributes.semantics = semantics;
        }
        this.name = "BinaryNode";
    }

    compile = (compiler) => {
        const operator = this.attributes.operator;
        const semantics = this.attributes.semantics ?? 'symfony';

        if ('matches' === operator) {
            this.compileMatches(compiler, semantics);
            return;
        }

        if ('js' !== semantics) {
            this.compileWithRuntime(compiler, `__runtime.${semantics}`);
            return;
        }

        if ('..' === operator) {
            compiler.raw('(function(__s, __e){var __r=[],__i;if(Math.abs(__e-__s)+1>10000000){var __x=new RangeError("The supplied range exceeds the maximum array size: start="+__s+", end="+__e);__x.name="ValueError";throw __x;}if(__s<=__e){for(__i=__s;__i<=__e;__i++){__r.push(__i);}}else{for(__i=__s;__i>=__e;__i--){__r.push(__i);}}return __r;})(')
                .compile(this.nodes.left)
                .raw(', ')
                .compile(this.nodes.right)
                .raw(')');

            return;
        }

        if (STRING_OPERATORS[operator] !== undefined) {
            const fold = this.attributes.case_insensitive ? '.toLowerCase()' : '';
            compiler.raw('(String(')
                .compile(this.nodes.left)
                .raw(' ?? "")' + fold + '.' + STRING_OPERATORS[operator] + '(String(')
                .compile(this.nodes.right)
                .raw(' ?? "")' + fold + '))');

            return;
        }

        if ('in' === operator || 'not in' === operator) {
            // Self-contained: evaluates left/right in the same left-then-right order as evaluate()
            const check = 'not in' === operator ? '=== -1' : '>= 0';
            compiler.raw('(function(__l, __r){if(!Array.isArray(__r)){if(__r!==null&&typeof __r==="object"){__r=Object.keys(__r).map(function(__k){return __r[__k];});}' +
                    'else{throw new TypeError("in_array(): Argument #2 ($haystack) must be of type array, "+(__r===null||__r===undefined?"null":typeof __r==="number"?(Number.isInteger(__r)?"int":"float"):typeof __r==="boolean"?"bool":typeof __r)+" given");}}return __r.indexOf(__l) ' + check + ';})(')
                .compile(this.nodes.left)
                .raw(', ')
                .compile(this.nodes.right)
                .raw(')');

            return;
        }

        if ('/' === operator || '%' === operator) {
            const message = '/' === operator ? 'Division by zero.' : 'Modulo by zero.';
            compiler.raw('(function(__l, __r){if(__r===null||__r===undefined||0==__r){var __e=new Error("' + message + '");__e.name="DivisionByZeroError";throw __e;}return __l ' + operator + ' __r;})(')
                .compile(this.nodes.left)
                .raw(', ')
                .compile(this.nodes.right)
                .raw(')');

            return;
        }

        if ('~' === operator) {
            // PHP's concatenation: null is an empty string
            compiler.raw('(String(')
                .compile(this.nodes.left)
                .raw(' ?? "") + String(')
                .compile(this.nodes.right)
                .raw(' ?? ""))');

            return;
        }

        if ('xor' === operator) {
            compiler.raw('(!(')
                .compile(this.nodes.left)
                .raw(') !== !(')
                .compile(this.nodes.right)
                .raw('))');

            return;
        }

        if ('and' === operator || '&&' === operator || 'or' === operator || '||' === operator) {
            // Logical operators yield booleans (not one of their operands), like PHP's
            compiler.raw('(!!(')
                .compile(this.nodes.left)
                .raw('and' === operator || '&&' === operator ? ' && ' : ' || ')
                .compile(this.nodes.right)
                .raw('))');

            return;
        }

        if ('**' === operator) {
            compiler.raw('Math.pow(')
                .compile(this.nodes.left)
                .raw(", ")
                .compile(this.nodes.right)
                .raw(")");

            return;
        }

        compiler.raw("(")
            .compile(this.nodes.left)
            .raw(' ')
            .raw(operator)
            .raw(' ')
            .compile(this.nodes.right)
            .raw(")");
    };

    /**
     * The operator is a call to the runtime of the semantics, which CompileRuntime provides as `__runtime.symfony` / `__runtime.portable`.
     */
    compileWithRuntime = (compiler, runtime) => {
        const operator = this.attributes.operator;

        if ('and' === operator || '&&' === operator || 'or' === operator || '||' === operator || 'xor' === operator) {
            const glue = {'and': ' && ', '&&': ' && ', 'or': ' || ', '||': ' || ', 'xor': ' !== '}[operator];
            compiler.raw(`(${runtime}.truthy(`)
                .compile(this.nodes.left)
                .raw(`)${glue}${runtime}.truthy(`)
                .compile(this.nodes.right)
                .raw('))');

            return;
        }

        compiler.raw(`${runtime}.${OPERATIONS[operator]}(`)
            .compile(this.nodes.left)
            .raw(', ')
            .compile(this.nodes.right);
        if (this.attributes.case_insensitive) {
            compiler.raw(', true');
        }
        compiler.raw(')');
    };

    compileMatches = (compiler, semantics) => {
        const right = this.nodes.right;
        // the subject is converted to a string with the rules of the semantics
        const subject = 'js' === semantics ? ['String(', ' ?? "")'] : [`__runtime.${semantics}.matchSubject(`, ')'];

        if (right instanceof ConstantNode) {
            // The regex is known up front: validate it now and compile to a literal RegExp
            let regexp;
            try {
                regexp = toRegExp(right.evaluate({}, {}));
            } catch (e) {
                throw new SyntaxError(e.message);
            }
            compiler.raw('(new RegExp(' + JSON.stringify(regexp.source) + ', ' + JSON.stringify(regexp.flags) + ').test(' + subject[0])
                .compile(this.nodes.left)
                .raw(subject[1] + '))');

            return;
        }

        if (right instanceof BinaryNode && '~' !== right.attributes.operator) {
            throw new SyntaxError('The regex passed to "matches" must be a string');
        }

        // The regex is only known at runtime: embed the (self-contained) pattern converter
        compiler.raw('((' + toRegExp.toString() + ')(')
            .compile(right)
            .raw(').test(' + subject[0])
            .compile(this.nodes.left)
            .raw(subject[1] + '))');
    };

    evaluate = (functions, values) => {
        const ops = getSemantics(this.attributes.semantics);
        const operator = this.attributes.operator;
        const left = this.nodes.left.evaluate(functions, values);

        switch (operator) {
            case 'or':
            case '||':
                return ops.truthy(left) ? true : ops.truthy(this.nodes.right.evaluate(functions, values));
            case 'and':
            case '&&':
                return ops.truthy(left) ? ops.truthy(this.nodes.right.evaluate(functions, values)) : false;
        }

        const right = this.nodes.right.evaluate(functions, values);

        switch (operator) {
            case 'xor':
                return ops.truthy(left) !== ops.truthy(right);
            case 'matches':
                if ('string' !== typeof right) {
                    throw new SyntaxError('The regex passed to "matches" must be a string');
                }
                return matches(right, ops.matchSubject(left));
            case 'contains':
            case 'starts with':
            case 'ends with':
                return ops[OPERATIONS[operator]](left, right, !!this.attributes.case_insensitive);
        }

        if (OPERATIONS[operator] !== undefined) {
            return ops[OPERATIONS[operator]](left, right);
        }

        throw new Error(`"BinaryNode" does not support the "${operator}" operator.`);
    };

    toArray = () => {
        return ["(", this.nodes.left, ' ' + this.attributes.operator + ' ', this.nodes.right, ")"];
    }

}
