import {getEditDistance} from "./lib/Levenshtein";

export default class SyntaxError extends Error {
    constructor(message, cursor = 0, expression = '', subject, proposals) {
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

        // Compute 1-based line and column from the cursor
        if (expression) {
            const lines = String(expression).split(/\r\n|\r|\n/);
            let charCount = 0;
            this.line = 1;
            this.column = cursor + 1;
            for (let i = 0; i < lines.length; i++) {
                const lineLen = lines[i].length + 1;
                if (charCount + lineLen > cursor || i === lines.length - 1) {
                    this.line = i + 1;
                    this.column = Math.max(0, cursor - charCount) + 1;
                    break;
                }
                charCount += lineLen;
            }
        } else {
            this.line = 1;
            this.column = cursor + 1;
        }
    }

    /**
     * Formats a code frame pointing to the location of the syntax error in the expression.
     *
     * @returns {string}
     */
    formatPretty() {
        if (!this.expression) {
            return this.message;
        }

        const lines = String(this.expression).split(/\r\n|\r|\n/);
        const lineIdx = Math.min(Math.max(0, this.line - 1), lines.length - 1);
        const colIdx = Math.max(0, this.column - 1);

        const lineNum = String(lineIdx + 1);
        const gutter = ' '.repeat(lineNum.length) + ' | ';
        const pointer = ' '.repeat(colIdx) + '^';

        return [
            this.message,
            `${lineNum} | ${lines[lineIdx]}`,
            `${gutter}${pointer}`,
        ].join('\n');
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }
}
