import Node from "./Node";
import ConstantNode from "./ConstantNode";

export default class ArrayNode extends Node {
    constructor() {
        super();
        this.name = "ArrayNode";
        this.type = "Array";
        this.index = -1;
        this.keyIndex = -1;
    }

    addElement = (value, key = null) => {
        if (null === key) {
            key = new ConstantNode(++this.index);
        }
        else {
            if (this.type === 'Array') {
                this.type = 'Object';
            }
        }

        this.nodes[(++this.keyIndex).toString()] = key;
        this.nodes[(++this.keyIndex).toString()] = value;
    };

    compile = (compiler) => {
        if (this.type === 'Object') {
            compiler.raw('{');
        }
        else {
            compiler.raw('[');
        }
        this.compileArguments(compiler, this.type !== "Array");
        if (this.type === 'Object') {
            compiler.raw('}');
        }
        else {
            compiler.raw(']');
        }
    };

    evaluate = (functions, values) => {
        let result;
        if (this.type === 'Array') {
            result = [];
            for (let pair of this.getKeyValuePairs()) {
                result.push(pair.value.evaluate(functions, values));
            }
        }
        else {
            result = {};
            for (let pair of this.getKeyValuePairs()) {
                result[pair.key.evaluate(functions, values)] = pair.value.evaluate(functions, values);
            }
        }

        return result;
    };

    toArray() {
        let value = {};
        for (let pair of this.getKeyValuePairs()) {
            value[pair.key.attributes.value] = pair.value;
        }

        let array = [];

        if (this.isHash(value)) {
            for (let k of Object.keys(value)) {
                array.push(', ');
                array.push(new ConstantNode(k));
                array.push(': ');
                array.push(value[k]);
            }
            array[0] = '{';
            array.push('}');
        }
        else {
            for (let v of Object.values(value)) {
                array.push(', ');
                array.push(v);
            }
            array[0] = '[';
            array.push(']');
        }

        return array;
    };

    getKeyValuePairs = () => {
        let pairs = [];
        let nodes = Object.values(this.nodes);
        let i,j,pair,chunk = 2;
        for (i=0,j=nodes.length; i<j; i+=chunk) {
            pair = nodes.slice(i,i+chunk);
            pairs.push({key: pair[0], value: pair[1]});
        }

        return pairs;
    };

    compileArguments = (compiler, withKeys=true) => {
        let first = true;
        for (let pair of this.getKeyValuePairs()) {
            if (!first) {
                compiler.raw(', ');
            }
            first = false;

            if (withKeys) {
                compiler.compile(pair.key)
                    .raw(': ');
            }

            compiler.compile(pair.value);
        }
    };
}