import ArrayNode from "./ArrayNode";

export default class ArgumentsNode extends ArrayNode {
    constructor() {
        super();
        this.name = "ArgumentsNode";
    }

    compile = (compiler) => {
        this.compileArguments(compiler, false);
    };

    toArray() {
        let array = [];
        for (let pair of this.getKeyValuePairs()) {
            array.push(pair.value);
            array.push(", ");
        }
        array.pop();

        return array;
    }
}