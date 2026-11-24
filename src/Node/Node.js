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



    /**
     * Traverses this node and all descendant nodes in depth-first pre-order.
     * The visitor callback receives (node, parent, key).
     * If the visitor returns false, traversal of the current node's children is skipped.
     *
     * @param {function(Node, Node|null, string|number|null): (boolean|void)} visitor
     * @param {Node|null} [parent=null]
     * @param {string|number|null} [key=null]
     */
    walk = (visitor, parent = null, key = null) => {
        const shouldContinue = visitor(this, parent, key);
        if (shouldContinue === false) {
            return;
        }

        if (this.nodes) {
            if (Array.isArray(this.nodes)) {
                for (let i = 0; i < this.nodes.length; i++) {
                    const child = this.nodes[i];
                    if (child && typeof child.walk === 'function') {
                        child.walk(visitor, this, i);
                    }
                }
            } else if (typeof this.nodes === 'object') {
                for (const [k, child] of Object.entries(this.nodes)) {
                    if (child && typeof child.walk === 'function') {
                        child.walk(visitor, this, k);
                    }
                }
            }
        }
    };

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

    evaluateAsync = async (functions, values) => {
        let results = [];
        for (let node of Object.values(this.nodes)) {
            const evaluated = node.evaluateAsync ? await node.evaluateAsync(functions, values) : node.evaluate(functions, values);
            results.push(await evaluated);
        }

        return results;
    };

    toArray = () => {
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