import Compiler from "./Compiler";
import LogicException from "./LogicException";
import SyntaxError from "./SyntaxError";
import ConstantNode from "./Node/ConstantNode";
import {addcslashes} from "./lib/addcslashes";
import {toRegExp} from "./lib/pregPattern";

const FUNCTIONS = {
    '**': 'pow',
    '..': 'range',
    'in': '\\in_array',
    'not in': '!\\in_array',
    'contains': 'str_contains',
    'starts with': 'str_starts_with',
    'ends with': 'str_ends_with',
};

const OPERATORS = {
    '~': '.',
    'and': '&&',
    'or': '||',
};

const GET_ATTR_CLASS = '\\Symfony\\Component\\ExpressionLanguage\\Node\\GetAttrNode';

/**
 * Compiles a node tree to PHP, the way Symfony's own nodes compile themselves.
 *
 * The generated code is meant to run inside a method that declares one local variable per expression variable
 * (`$name = $values['name'] ?? null;`) and receives the registered functions as an array when it needs them.
 *
 * A function that has no PHP compiler (see ExpressionFunction#withPhpFunction()), or whose PHP compiler throws, is called
 * through its evaluator: `$functions['name']['evaluator']($values, ...$arguments)`. Symfony's own
 * CompiledExpressionLanguage does the same, which means that function has to be registered under that name on the PHP side.
 */
export default class PhpCompiler extends Compiler {
    /**
     * @param {Object} functions The registered functions
     * @param {Object} options
     * @param {string} options.valuesVariable Name (without "$") of the variable holding the values
     * @param {string} options.functionsVariable Name (without "$") of the variable holding the functions
     */
    constructor(functions, {valuesVariable = 'values', functionsVariable = 'functions'} = {}) {
        super(functions);
        this.valuesVariable = valuesVariable;
        this.functionsVariable = functionsVariable;
        this.usesFunctions = false;
    }

    reset = () => {
        this.source = '';
        this.usesFunctions = false;

        return this;
    };

    compile = (node) => {
        this.compileNode(node);

        return this;
    };

    subcompile = (node) => {
        const current = this.source;
        this.source = '';

        this.compileNode(node);

        const source = this.source;
        this.source = current;

        return source;
    };

    /**
     * Adds a quoted string to the compiled code.
     */
    string = (value) => {
        this.source += '"' + addcslashes(String(value), "\0\t\"\$\\") + '"';

        return this;
    };

    /**
     * Returns a PHP representation of a given value.
     */
    repr = (value) => {
        if (typeof value === 'number') {
            if (Number.isNaN(value)) {
                this.raw('NAN');
            }
            else if (!Number.isFinite(value)) {
                this.raw(value > 0 ? 'INF' : '-INF');
            }
            else {
                this.raw(String(value));
            }
        }
        else if (null === value || undefined === value) {
            this.raw('null');
        }
        else if (typeof value === 'boolean') {
            this.raw(value ? 'true' : 'false');
        }
        else if (Array.isArray(value) || typeof value === 'object') {
            this.raw('[');
            let first = true;
            for (const key of Object.keys(value)) {
                if (!first) {
                    this.raw(', ');
                }
                first = false;
                this.repr(Array.isArray(value) ? Number(key) : key);
                this.raw(' => ');
                this.repr(value[key]);
            }
            this.raw(']');
        }
        else {
            this.string(value);
        }

        return this;
    };

    compileNode(node) {
        switch (node.name) {
            case 'ConstantNode': return this.compileConstant(node);
            case 'NameNode': return this.raw('$' + node.attributes.name);
            case 'NullCoalescedNameNode': return this.raw('$' + node.attributes.name + ' ?? null');
            case 'UnaryNode': return this.compileUnary(node);
            case 'BinaryNode': return this.compileBinary(node);
            case 'ConditionalNode': return this.compileConditional(node);
            case 'NullCoalesceNode': return this.compileNullCoalesce(node);
            case 'ArrayNode': return this.compileArray(node, true);
            case 'ArgumentsNode': return this.compileArray(node, false);
            case 'FunctionNode': return this.compileFunction(node);
            case 'GetAttrNode': return this.compileGetAttr(node);
        }

        throw new LogicException(`A "${node.name}" cannot be compiled to PHP.`);
    }

    compileConstant(node) {
        const value = node.attributes.value;
        if (node.isFloat && typeof value === 'number' && Number.isFinite(value) && /^-?\d+$/.test(String(value))) {
            // 1.0 or 1e3: PHP must not read it as an int
            return this.raw(String(value) + '.0');
        }

        return this.repr(value);
    }

    compileUnary(node) {
        const operators = {'!': '!', 'not': '!', '+': '+', '-': '-', '~': '~'};

        return this.raw('(').raw(operators[node.attributes.operator]).compile(node.nodes.node).raw(')');
    }

    compileConditional(node) {
        return this.raw('((').compile(node.nodes.expr1).raw(') ? (').compile(node.nodes.expr2).raw(') : (').compile(node.nodes.expr3).raw('))');
    }

    compileNullCoalesce(node) {
        return this.raw('((').compile(node.nodes.expr1).raw(') ?? (').compile(node.nodes.expr2).raw('))');
    }

    compileArray(node, withKeys) {
        if (withKeys) {
            this.raw('[');
        }
        let first = true;
        for (const pair of node.getKeyValuePairs()) {
            if (!first) {
                this.raw(', ');
            }
            first = false;

            if (withKeys) {
                this.compile(pair.key).raw(' => ');
            }
            this.compile(pair.value);
        }
        if (withKeys) {
            this.raw(']');
        }

        return this;
    }

    compileFunction(node) {
        const args = Object.values(node.nodes.fnArguments.nodes).map((argument) => this.subcompile(argument));
        const name = node.attributes.name;
        const phpCompiler = this.getFunction(name).phpCompiler;

        if (phpCompiler) {
            try {
                return this.raw(phpCompiler(...args));
            } catch (e) {
                // fall through: the function is called through its evaluator
            }
        }

        this.usesFunctions = true;

        return this.raw(`$${this.functionsVariable}[${this.phpString(name)}]['evaluator']($${this.valuesVariable}${args.map((arg) => ', ' + arg).join('')})`);
    }

    compileGetAttr(node) {
        const attribute = node.nodes.attribute;
        const nullSafe = (attribute instanceof ConstantNode && attribute.isNullSafe) || node.attributes.is_null_safe;

        switch (node.attributes.type) {
            case 1: // PROPERTY_CALL
                return this.compile(node.nodes.node).raw(nullSafe ? '?->' : '->').raw(attribute.attributes.value);
            case 2: // METHOD_CALL
                return this.compile(node.nodes.node).raw(nullSafe ? '?->' : '->').raw(attribute.attributes.value)
                    .raw('(').compile(node.nodes.fnArguments).raw(')');
            case 3: // ARRAY_CALL
                if (nullSafe) {
                    return this.raw(GET_ATTR_CLASS + '::convertToArrayAccess(').compile(node.nodes.node).raw(', ')
                        .string(node.nodes.node.dump()).raw(')?->offsetGet(').compile(attribute).raw(')');
                }

                return this.compile(node.nodes.node).raw('[').compile(attribute).raw(']');
        }

        throw new LogicException('Unknown GetAttrNode type.');
    }

    compileBinary(node) {
        const operator = node.attributes.operator;
        const left = node.nodes.left;
        const right = node.nodes.right;

        if ('matches' === operator) {
            if (right instanceof ConstantNode) {
                try {
                    toRegExp(right.attributes.value);
                } catch (e) {
                    throw new SyntaxError(e.message);
                }
            }
            else if (right.name === 'BinaryNode' && '~' !== right.attributes.operator) {
                throw new SyntaxError('The regex passed to "matches" must be a string');
            }

            return this.raw('(static function ($regexp, $str) { set_error_handler(static fn ($t, $m) => throw new \\Symfony\\Component\\ExpressionLanguage\\SyntaxError(sprintf(\'Regexp "%s" passed to "matches" is not valid\', $regexp).substr($m, 12))); try { return preg_match($regexp, (string) $str); } finally { restore_error_handler(); } })(')
                .compile(right).raw(', ').compile(left).raw(')');
        }

        if (node.attributes.case_insensitive) {
            // mb_strtolower() needs ext-mbstring, which only these (opt-in) case-insensitive operators ask for
            return this.raw(`${FUNCTIONS[operator]}(\\mb_strtolower(`).compile(left).raw('), \\mb_strtolower(').compile(right).raw('))');
        }

        if (FUNCTIONS[operator] !== undefined) {
            this.raw(`${FUNCTIONS[operator]}(`).compile(left).raw(', ').compile(right);
            if ('in' === operator || 'not in' === operator) {
                this.raw(', true');
            }

            return this.raw(')');
        }

        return this.raw('(').compile(left).raw(' ').raw(OPERATORS[operator] ?? operator).raw(' ').compile(right).raw(')');
    }

    phpString(value) {
        return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    }
}
