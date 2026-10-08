/**
 * Thrown by the `/` and `%` operators when the right operand is zero, like PHP's DivisionByZeroError.
 */
export default class DivisionByZeroError extends Error {
    constructor(message = "Division by zero.") {
        super(message);
        this.name = "DivisionByZeroError";
    }
}
