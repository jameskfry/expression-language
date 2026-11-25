import Node from "./Node";

export default class NameNode extends Node {
    constructor(name) {
        super({}, {name: name});
        this.name = 'NameNode';
    }

    compile = (compiler) => {
        compiler.raw(this.attributes.name);
    };

    evaluate = (functions, values) => {
        //console.log(`Checking for value of "${this.attributes.name}"`);
        let value = values[this.attributes.name];
        //console.log(`Value: ${value}`);
        return value;
    };

    evaluateAsync = async (functions, values) => {
        let value = values[this.attributes.name];
        return await value;
    };

    toArray = () => {
        return [this.attributes.name];
    }
}