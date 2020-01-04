import SyntaxError from "./SyntaxError";

export class TokenStream {
    constructor(expression, tokens) {
        this.expression = expression;
        this.position = 0;
        this.tokens = tokens;
    }

    get current() {
        return this.tokens[this.position];
    }

    get last() {
        return this.tokens[this.position - 1];
    }

    toString() {
        return this.tokens.join("\n");
    }

    next = () => {
        this.position += 1;

        if (this.tokens[this.position] === undefined) {
            throw new SyntaxError("Unexpected end of expression", this.last.cursor, this.expression);
        }
    };

    expect = (type, value, message) => {
        let token = this.current;
        if (!token.test(type, value)) {
            let compiledMessage = "";
            if (message) {
                compiledMessage = message + ". ";
            }
            let valueMessage = "";
            if (value) {
                valueMessage = ` with value "${value}"`;
            }
            compiledMessage += `Unexpected token "${token.type}" of value "${token.value}" ("${type}" expected${valueMessage})`;

            throw new SyntaxError(compiledMessage, token.cursor, this.expression);
        }
        this.next();
    };

    isEOF = () => {
        return Token.EOF_TYPE === this.current.type;
    };

    isEqualTo = (ts) => {
        if (ts === null ||
            ts === undefined ||
            !ts instanceof TokenStream) {
            return false;
        }

        if (ts.tokens.length !== this.tokens.length) {
            return false;
        }

        let tsStartPosition = ts.position;
        ts.position = 0;
        let allTokensMatch = true;
        for (let token of this.tokens) {
            let match = ts.current.isEqualTo(token);
            if (!match) {
                allTokensMatch = false;
                break;
            }
            if (ts.position < ts.tokens.length - 1) {
                ts.next();
            }
        }
        ts.position = tsStartPosition;

        return allTokensMatch;
    };

    diff = (ts) => {
        let diff = [];
        if (!this.isEqualTo(ts)) {
            let index = 0;
            let tsStartPosition = ts.position;
            ts.position = 0;
            for (let token of this.tokens) {
                let tokenDiff = token.diff(ts.current);
                if (tokenDiff.length > 0) {
                    diff.push({index: index, diff: tokenDiff});
                }
                if (ts.position < ts.tokens.length - 1) {
                    ts.next();
                }
            }
            ts.position = tsStartPosition;
        }
        return diff;
    };
}


export class Token {
    static EOF_TYPE = 'end of expression';
    static NAME_TYPE = 'name';
    static NUMBER_TYPE = 'number';
    static STRING_TYPE = 'string';
    static OPERATOR_TYPE = 'operator';
    static PUNCTUATION_TYPE = 'punctuation';

    constructor(type, value, cursor) {
        this.value = value;
        this.type = type;
        this.cursor = cursor;
    }

    test = (type, value = null) => {
        return this.type === type && (null === value || this.value === value);
    };

    toString() {
        return `${this.cursor} [${this.type}] ${this.value}`;
    }

    isEqualTo = (t) => {
        if (t === null || t === undefined || !t instanceof Token) {
            return false;
        }

        return t.value == this.value && t.type === this.type && t.cursor === this.cursor;
    };

    diff = (t) => {
        let diff = [];
        if (!this.isEqualTo(t)) {
            if (t.value !== this.value) {
                diff.push(`Value: ${t.value} != ${this.value}`);
            }
            if (t.cursor !== this.cursor) {
                diff.push(`Cursor: ${t.cursor} != ${this.cursor}`);
            }
            if (t.type !== this.type) {
                diff.push(`Type: ${t.type} != ${this.type}`);
            }
        }
        return diff;
    };
}