import {getEditDistance} from "./lib/Levenshtein";

function splitLinesWithOffsets(str) {
    const text = String(str);
    const lines = [];
    const regex = /\r\n|\r|\n/g;
    let start = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        lines.push({
            text: text.slice(start, match.index),
            start,
            nextStart: match.index + match[0].length,
        });
        start = match.index + match[0].length;
    }
    lines.push({
        text: text.slice(start),
        start,
        nextStart: text.length + 1,
    });
    return lines;
}

export default class SyntaxError extends Error {
    constructor(message, cursor = 0, expression = '', subject, proposals, options) {
        // Like Symfony, the position, the expression and the "Did you mean" hint are part of the message itself
        let fullMessage = `${String(message).replace(/\.+$/, '')} around position ${cursor}`;
        if (expression) {
            fullMessage += ` for expression \`${expression}\``;
        }
        fullMessage += ".";

        if (subject && proposals) {
            let minScore = Number.MAX_SAFE_INTEGER,
                guess = null;
            for (let proposal of proposals) {
                let distance = getEditDistance(subject, proposal);
                if (distance < minScore) {
                    guess = proposal;
                    minScore = distance;
                }
            }

            if (guess !== null && minScore < 3) {
                fullMessage += ` Did you mean "${guess}"?`;
            }
        }

        super(fullMessage);
        this.name = "SyntaxError";
        this.cursor = cursor;
        this.expression = expression;
        this.subject = subject;
        this.proposals = proposals;

        const rawSource = options && options.rawExpression !== undefined ? String(options.rawExpression) : String(expression || '');
        Object.defineProperty(this, '_rawExpression', {
            value: rawSource,
            enumerable: false,
            configurable: true,
        });

        // Token cursors are 1-based (matching Symfony), whereas Lexer character errors pass 0-based indices via options.zeroBased
        const rawOffset = options && options.zeroBased ? Math.max(0, cursor) : Math.max(0, cursor - 1);

        if (rawSource) {
            const offset = Math.min(rawOffset, rawSource.length);
            const lines = splitLinesWithOffsets(rawSource);
            this.line = 1;
            this.column = offset + 1;
            for (let i = 0; i < lines.length; i++) {
                if (offset < lines[i].nextStart || i === lines.length - 1) {
                    this.line = i + 1;
                    this.column = Math.max(0, offset - lines[i].start) + 1;
                    break;
                }
            }
        } else {
            this.line = 1;
            this.column = rawOffset + 1;
        }
    }

    /**
     * Formats a code frame pointing to the location of the syntax error in the expression.
     *
     * @returns {string}
     */
    formatPretty() {
        const source = this._rawExpression || this.expression;
        if (!source) {
            return this.message;
        }

        const lines = splitLinesWithOffsets(source);
        const lineIdx = Math.min(Math.max(0, this.line - 1), lines.length - 1);
        const colIdx = Math.max(0, this.column - 1);

        const lineNum = String(lineIdx + 1);
        const gutter = ' '.repeat(lineNum.length) + ' | ';
        const pointer = ' '.repeat(colIdx) + '^';

        return [
            this.message,
            `${lineNum} | ${lines[lineIdx].text}`,
            `${gutter}${pointer}`,
        ].join('\n');
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }
}
