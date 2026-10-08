/**
 * Raised by the "portable" semantics when an operation would not give the same result in PHP (Symfony) and in JavaScript.
 */
export default class PortabilityError extends Error {
    /**
     * @param {string} operator
     * @param {Array} operands
     * @param {{value?: *, error?: Error}} symfony What Symfony's rules give
     * @param {{value?: *, error?: Error}} javascript What JavaScript's rules give
     */
    constructor(operator, operands, symfony, javascript) {
        const show = (value) => {
            if (typeof value === 'string') {
                return JSON.stringify(value);
            }
            try {
                const json = JSON.stringify(value);

                return json === undefined ? String(value) : json;
            } catch (e) {
                return String(value);
            }
        };
        const outcome = (result) => ('error' in result ? `${result.error.name}: ${result.error.message}` : show(result.value));

        super(`"${operator}" is not portable: with ${operands.map(show).join(' and ')}, PHP gives ${outcome(symfony)} and JavaScript gives ${outcome(javascript)}.`);
        this.name = 'PortabilityError';
        this.operator = operator;
        this.operands = operands;
        this.symfony = symfony;
        this.javascript = javascript;
    }
}
