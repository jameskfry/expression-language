export default class AbstractProvider {
    getFunctions() {
        throw new Error("getFunctions must be implemented by " + this.name);
    };
}