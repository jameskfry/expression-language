import {is_scalar} from "../lib/is-scalar";
import {addcslashes} from "../lib/addcslashes";

export default class Node {
    constructor(nodes = {}, attributes = {}) {
        this.name = 'Node';
        this.nodes = nodes;
        this.attributes = attributes;
    }

    toString() {
        let attributes = [];
        for (let name of Object.keys(this.attributes)) {
            let oneAttribute = 'null';
            if (this.attributes[name]) {
                oneAttribute = this.attributes[name].toString();
            }
            attributes.push(`${name}: '${oneAttribute}'`);
        }

        let repr = [this.name + "(" + attributes.join(", ")];

        if (this.nodes.length > 0) {
            for (let node of Object.values(this.nodes)) {
                let lines = node.toString().split("\n");
                for(let line of lines) {
                    repr.push("    " + line);
                }
            }
            repr.push(")");
        }
        else {
            repr[0] += ")";
        }

        return repr.join("\n");
    }



    compile = (compiler) => {
        for (let node of Object.values(this.nodes)) {
            node.compile(compiler);
        }
    };

    evaluate = (functions, values) => {
        let results = [];
        for (let node of Object.values(this.nodes)) {
            results.push(node.evaluate(functions, values));
        }

        return results;
    };

    toArray() {
        throw new Error(`Dumping a "${this.name}" instance is not supported yet.`);
    }

    dump = () => {
        let dump = "";

        for (let v of this.toArray()) {
            dump += is_scalar(v) ? v : v.dump();
        }

        return dump;
    };

    dumpString = (value) => {
        return `"${addcslashes(value, "\0\t\"\\")}"`;
    };

    isHash = (value) => {
        let expectedKey = 0;

        for (let key of Object.keys(value)) {
            key = parseInt(key);
            if (key !== expectedKey++) {
                return true;
            }
        }
        return false;
    };
}