import SyntaxError from "./SyntaxError";
import {Token} from "./TokenStream"
import Node from "./Node/Node";
import BinaryNode from "./Node/BinaryNode";
import UnaryNode from "./Node/UnaryNode";
import ConstantNode from "./Node/ConstantNode";
import ConditionalNode from "./Node/ConditionalNode";
import FunctionNode from "./Node/FunctionNode";
import NameNode from "./Node/NameNode";
import ArrayNode from "./Node/ArrayNode";
import ArgumentsNode from "./Node/ArgumentsNode";
import GetAttrNode from "./Node/GetAttrNode";


export const OPERATOR_LEFT = 1;
export const OPERATOR_RIGHT = 2;

export default class Parser {
    functions = {};
    unaryOperators = {
        'not': {'precedence': 50},
        '!': {'precedence': 50},
        '-': {'precedence': 500},
        '+': {'precedence': 500}
    };

    binaryOperators = {
        'or': {'precedence': 10, 'associativity': OPERATOR_LEFT},
        '||': {'precedence': 10, 'associativity': OPERATOR_LEFT},
        'and': {'precedence': 15, 'associativity': OPERATOR_LEFT},
        '&&': {'precedence': 15, 'associativity': OPERATOR_LEFT},
        '|': {'precedence': 16, 'associativity': OPERATOR_LEFT},
        '^': {'precedence': 17, 'associativity': OPERATOR_LEFT},
        '&': {'precedence': 18, 'associativity': OPERATOR_LEFT},
        '==': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '===': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '!=': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '!==': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '<': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '>': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '>=': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '<=': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        'not in': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        'in': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        'matches': {'precedence': 20, 'associativity': OPERATOR_LEFT},
        '..': {'precedence': 25, 'associativity': OPERATOR_LEFT},
        '+': {'precedence': 30, 'associativity': OPERATOR_LEFT},
        '-': {'precedence': 30, 'associativity': OPERATOR_LEFT},
        '~': {'precedence': 40, 'associativity': OPERATOR_LEFT},
        '*': {'precedence': 60, 'associativity': OPERATOR_LEFT},
        '/': {'precedence': 60, 'associativity': OPERATOR_LEFT},
        '%': {'precedence': 60, 'associativity': OPERATOR_LEFT},
        '**': {'precedence': 200, 'associativity': OPERATOR_RIGHT}
    };

    constructor(functions = {}) {
        this.functions = functions;
        this.tokenStream = null;
        this.names = null;
        this.objectMatches = {};
        this.cachedNames = null;
        this.nestedExecutions = 0;
    }

    parse = (tokenStream, names=[]) => {
        this.tokenStream = tokenStream;
        this.names = names;
        this.objectMatches = {};
        this.cachedNames = null;
        this.nestedExecutions = 0;
        //console.log("tokens: ", tokenStream.toString());

        let node = this.parseExpression();

        if (!this.tokenStream.isEOF()) {
            throw new SyntaxError(`Unexpected token "${this.tokenStream.current.type}" of value "${this.tokenStream.current.value}".`, this.tokenStream.current.cursor, this.tokenStream.expression);
        }

        return node;
    };

    parseExpression = (precedence = 0) => {
        let expr = this.getPrimary();
        let token = this.tokenStream.current;
        this.nestedExecutions++;
        if (this.nestedExecutions > 100) {
            throw new Error("Way to many executions on '" + token.toString() + "' of '" + this.tokenStream.toString() + "'");
        }

        //console.log("Parsing: ", token);

        while (token.test(Token.OPERATOR_TYPE)
            && this.binaryOperators[token.value] !== undefined
            && this.binaryOperators[token.value] !== null
            && this.binaryOperators[token.value].precedence >= precedence) {

            let op = this.binaryOperators[token.value];
            this.tokenStream.next();

            let expr1 = this.parseExpression(OPERATOR_LEFT === op.associativity ? op.precedence + 1 : op.precedence);
            expr = new BinaryNode(token.value, expr, expr1);

            token = this.tokenStream.current;
        }

        if (0 === precedence) {
            return this.parseConditionalExpression(expr);
        }

        return expr;
    };

    getPrimary = () => {
        let token = this.tokenStream.current;

        if (token.test(Token.OPERATOR_TYPE)
            && this.unaryOperators[token.value] !== undefined
            && this.unaryOperators[token.value] !== null) {
            let operator = this.unaryOperators[token.value];
            this.tokenStream.next();
            let expr = this.parseExpression(operator.precedence);
            return this.parsePostfixExpression(new UnaryNode(token.value, expr));
        }

        if (token.test(Token.PUNCTUATION_TYPE, "(")) {
            //console.log("Found '('.", token.type, token.value);
            this.tokenStream.next();
            let expr = this.parseExpression();
            this.tokenStream.expect(Token.PUNCTUATION_TYPE, ")", "An opened parenthesis is not properly closed");

            return this.parsePostfixExpression(expr);
        }

        return this.parsePrimaryExpression();
    };

    parseConditionalExpression(expr) {
        while(this.tokenStream.current.test(Token.PUNCTUATION_TYPE, "?")) {
            this.tokenStream.next();
            let expr2, expr3;
            if (!this.tokenStream.current.test(Token.PUNCTUATION_TYPE, ":")) {
                expr2 = this.parseExpression();
                if (this.tokenStream.current.test(Token.PUNCTUATION_TYPE, ":")) {
                    this.tokenStream.next();
                    expr3 = this.parseExpression();
                }
                else {
                    expr3 = new ConstantNode(null);
                }
            }
            else {
                this.tokenStream.next();
                expr2 = expr;
                expr3 = this.parseExpression();
            }

            expr = new ConditionalNode(expr, expr2, expr3);
        }

        return expr;
    }

    parsePrimaryExpression() {
        let token = this.tokenStream.current,
            node = null;

        switch(token.type) {
            case Token.NAME_TYPE:
                this.tokenStream.next();
                switch(token.value) {
                    case 'true':
                    case 'TRUE':
                        return new ConstantNode(true);

                    case 'false':
                    case 'FALSE':
                        return new ConstantNode(false);

                    case 'null':
                    case 'NULL':
                        return new ConstantNode(null);

                    default:
                        if ("(" === this.tokenStream.current.value) {
                            if (this.functions[token.value] === undefined) {
                                throw new SyntaxError(`The function "${token.value}" does not exist`, token.cursor, this.tokenStream.expression, token.values, Object.keys(this.functions));
                            }

                            node = new FunctionNode(token.value, this.parseArguments());
                        }
                        else {
                            if (!this.hasVariable(token.value)) {
                                throw new SyntaxError(`Variable "${token.value}" is not valid`, token.cursor, this.tokenStream.expression, token.value, this.getNames());
                            }

                            let name = token.value;
                            //console.log("Checking for object matches: ", name, this.objectMatches, this.getNames());
                            if (this.objectMatches[name] !== undefined) {
                                name = this.getNames()[this.objectMatches[name]];
                            }

                            node = new NameNode(name);
                        }
                }
                break;
            case Token.NUMBER_TYPE:
            case Token.STRING_TYPE:
                this.tokenStream.next();

                return new ConstantNode(token.value);
            default:
                if(token.test(Token.PUNCTUATION_TYPE, "[")) {
                    node = this.parseArrayExpression();
                }
                else if (token.test(Token.PUNCTUATION_TYPE, "{")) {
                    node = this.parseHashExpression();
                }
                else {
                    throw new SyntaxError(`Unexpected token "${token.type}" of value "${token.value}"`, token.cursor, this.tokenStream.expression);
                }
        }

        return this.parsePostfixExpression(node);
    }

    hasVariable = (name) => {
        return this.getNames().indexOf(name) >= 0;
    };

    getNames = () => {
        if (this.cachedNames !== null) {
            return this.cachedNames;
        }

        if (this.names && this.names.length > 0) {
            let names = [];
            let index = 0;
            this.objectMatches = {};
            for (let name of this.names) {
                if (typeof name === "object") {
                    this.objectMatches[Object.values(name)[0]] = index;
                    names.push(Object.keys(name)[0]);
                    names.push(Object.values(name)[0]);
                }
                else {
                    names.push(name);
                }
                index++;
            }
            this.cachedNames = names;
            return names;
        }
        return [];
    };

    parseArrayExpression = () => {
        this.tokenStream.expect(Token.PUNCTUATION_TYPE, '[', 'An array element was expected');

        let node = new ArrayNode(),
            first = true;

        while(!this.tokenStream.current.test(Token.PUNCTUATION_TYPE, ']')) {
            if (!first) {
                this.tokenStream.expect(Token.PUNCTUATION_TYPE, ",", "An array element must be followed by a comma");

                // trailing ,?
                if (this.tokenStream.current.test(Token.PUNCTUATION_TYPE, "]")) {
                    break;
                }
            }
            first = false;
            node.addElement(this.parseExpression());
        }

        this.tokenStream.expect(Token.PUNCTUATION_TYPE, "]", "An opened array is not properly closed")

        return node;
    };

    parseHashExpression = () => {
        this.tokenStream.expect(Token.PUNCTUATION_TYPE, "{", "A hash element was expected");

        let node = new ArrayNode(),
            first = true;

        while(!this.tokenStream.current.test(Token.PUNCTUATION_TYPE, '}')) {
            if (!first) {
                this.tokenStream.expect(Token.PUNCTUATION_TYPE, ",", "An array element must be followed by a comma");

                // trailing ,?
                if (this.tokenStream.current.test(Token.PUNCTUATION_TYPE, "}")) {
                    break;
                }
            }
            first = false;

            let key = null;

            // a hash key can be:
            //
            //  * a number -- 12
            //  * a string -- 'a'
            //  * a name, which is equivalent to a string -- a
            //  * an expression, which must be enclosed in parentheses -- (1 + 2)
            if (this.tokenStream.current.test(Token.STRING_TYPE)
                || this.tokenStream.current.test(Token.NAME_TYPE)
                || this.tokenStream.current.test(Token.NUMBER_TYPE)) {

                key = new ConstantNode(this.tokenStream.current.value);
                this.tokenStream.next();
            }
            else if (this.tokenStream.current.test(Token.PUNCTUATION_TYPE, "(")) {
                key = this.parseExpression();
            }
            else {
                let current = this.tokenStream.current;

                throw new SyntaxError(`A hash key must be a quoted string, a number, a name, or an expression enclosed in parentheses (unexpected token "${current.type}" of value "${current.value}"`, current.cursor, this.tokenStream.expression);
            }

            this.tokenStream.expect(Token.PUNCTUATION_TYPE, ":", "A hash key must be followed by a colon (:)");
            let value = this.parseExpression();
            node.addElement(value, key);
        }

        this.tokenStream.expect(Token.PUNCTUATION_TYPE, "}", "An opened hash is not properly closed");

        return node;
    };

    parsePostfixExpression = (node) => {
        let token = this.tokenStream.current;
        while (Token.PUNCTUATION_TYPE === token.type) {
            if ('.' === token.value) {
                this.tokenStream.next();
                token = this.tokenStream.current;
                this.tokenStream.next();

                if (Token.NAME_TYPE !== token.type &&
                    // Operators like "not" and "matches" are valid method or property names,
                    //
                    // In other words, besides NAME_TYPE, OPERATOR_TYPE could also be parsed as a property or method.
                    // This is because operators are processed by the lexer prior to names. So "not" in "foo.not()" or "matches" in "foo.matches" will be recognized as an operator first.
                    // But in fact, "not" and "matches" in such expressions shall be parsed as method or property names.
                    //
                    // And this ONLY works if the operator consists of valid characters for a property or method name.
                    //
                    // Other types, such as STRING_TYPE and NUMBER_TYPE, can't be parsed as property nor method names.
                    //
                    // As a result, if $token is NOT an operator OR $token->value is NOT a valid property or method name, an exception shall be thrown.
                    (Token.OPERATOR_TYPE !== token.type || !/[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/.test(token.value))
                ) {
                    throw new SyntaxError('Expected name', token.cursor, this.tokenStream.expression);
                }

                let arg = new ConstantNode(token.value, true),
                    _arguments = new ArgumentsNode(),
                    type = null;

                if (this.tokenStream.current.test(Token.PUNCTUATION_TYPE, "(")) {
                    type = GetAttrNode.METHOD_CALL;
                    for (let n of Object.values(this.parseArguments().nodes)) {
                        _arguments.addElement(n);
                    }
                }
                else {
                    type = GetAttrNode.PROPERTY_CALL;
                }

                node = new GetAttrNode(node, arg, _arguments, type);
            }
            else if ('[' === token.value) {
                this.tokenStream.next();
                let arg = this.parseExpression();
                this.tokenStream.expect(Token.PUNCTUATION_TYPE, "]");

                node = new GetAttrNode(node, arg, new ArgumentsNode(), GetAttrNode.ARRAY_CALL);
            }
            else {
                break;
            }

            token = this.tokenStream.current;
        }

        return node;
    };

    parseArguments = () => {
        let args = [];
        this.tokenStream.expect(Token.PUNCTUATION_TYPE, "(", "A list of arguments must begin with an opening parenthesis");
        while (!this.tokenStream.current.test(Token.PUNCTUATION_TYPE, ")")) {
            if (args.length !== 0) {
                this.tokenStream.expect(Token.PUNCTUATION_TYPE, ",", "Arguments must be separated by a comma")
            }

            args.push(this.parseExpression());
        }

        this.tokenStream.expect(Token.PUNCTUATION_TYPE, ")", "A list of arguments must be closed by a parenthesis");

        return new Node(args);
    }
}
