import Node from "./Node";

export default class NullCoalescedNameNode extends Node {
    constructor(name) {
        super({}, {name});
        this.name = 'NullCoalescedNameNode';
    }

    compile = (compiler) => {
        // the name may not be declared at all when the compiled code runs
        compiler.raw(`(typeof ${this.attributes.name} === "undefined" ? null : ${this.attributes.name})`);
    }

    evaluate = (functions, values) => {
        return null;
    }

    toArray = () => {
        return [this.attributes.name + " ?? null"];
    }
}