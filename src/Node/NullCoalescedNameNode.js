import Node from "./Node";

export default class NullCoalescedNameNode extends Node {
    constructor(name) {
        super({}, {name});
        this.name = 'NullCoalescedNameNode';
    }

    compile = (compiler) => {
        compiler.raw(this.attributes.name + " ?? null");
    }

    evaluate = (functions, values) => {
        return null;
    }

    toArray = () => {
        return [this.attributes.name + " ?? null"];
    }
}