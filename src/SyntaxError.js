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
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }
}
