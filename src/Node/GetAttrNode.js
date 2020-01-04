import Node from "./Node";

export default class GetAttrNode extends Node {
    static PROPERTY_CALL = 1;
    static METHOD_CALL = 2;
    static ARRAY_CALL = 3;

    constructor(node, attribute, _arguments, type) {
        super(
            {node: node, attribute: attribute, arguments: _arguments},
            {type: type}
        );
        this.name = 'GetAttrNode';
    }

    compile = (compiler) => {
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                compiler.compile(this.nodes.node)
                    .raw('.')
                    .raw(this.nodes.attribute.attributes.value);
                break;
            case GetAttrNode.METHOD_CALL:
                compiler.compile(this.nodes.node)
                    .raw('.')
                    .raw(this.nodes.attribute.attributes.value)
                    .raw('(')
                    .compile(this.nodes.arguments)
                    .raw(')');
                break;
            case GetAttrNode.ARRAY_CALL:
                compiler.compile(this.nodes.node)
                    .raw('[')
                    .compile(this.nodes.attribute)
                    .raw(']');
                break;
        }
    };

    evaluate = (functions, values) => {
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                let obj = this.nodes.node.evaluate(functions, values),
                    property = this.nodes.attribute.attributes.value;
                if (typeof obj !== "object") {
                    throw new Error(`Unable to get property "${property}" on a non-object: ` + (typeof obj));
                }

                return obj[property];
            case GetAttrNode.METHOD_CALL:
                let obj2 = this.nodes.node.evaluate(functions, values),
                    method = this.nodes.attribute.attributes.value;
                if (typeof obj2 !== 'object') {
                    throw new Error(`Unable to call method "${method}" on a non-object: ` + (typeof obj2));
                }
                if (obj2[method] === undefined) {
                    throw new Error(`Method "${method}" is undefined on object.`);
                }
                if (typeof obj2[method] != 'function') {
                    throw new Error(`Method "${method}" is not a function on object.`);
                }
                let evaluatedArgs = this.nodes.arguments.evaluate(functions, values);
                return obj2[method].apply(null, evaluatedArgs);
            case GetAttrNode.ARRAY_CALL:
                let array = this.nodes.node.evaluate(functions, values);
                if (!Array.isArray(array) && typeof array !== 'object') {
                    throw new Error(`Unable to get an item on a non-array: ` + typeof array);
                }
                return array[this.nodes.attribute.evaluate(functions, values)];
        }
    };

    toArray() {
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                return [this.nodes.node, '.', this.nodes.attribute];
            case GetAttrNode.METHOD_CALL:
                return [this.nodes.node, '.', this.nodes.attribute, '(', this.nodes.arguments, ')'];
            case GetAttrNode.ARRAY_CALL:
                return [this.nodes.node, '[', this.nodes.attribute, ']'];
        }
    }
}
