export default class LogicException extends Error {
    constructor(message) {
        super(message);
        this.name = "LogicException";
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }
}