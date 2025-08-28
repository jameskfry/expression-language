import Node from "./Node";
import ConstantNode from "./ConstantNode";

export default class GetAttrNode extends Node {
    static PROPERTY_CALL = 1;
    static METHOD_CALL = 2;
    static ARRAY_CALL = 3;

    constructor(node, attribute, fnArguments, type) {
        super(
            {node: node, attribute: attribute, fnArguments: fnArguments},
            {type: type, is_null_coalesce: false, is_short_circuited: false}
        );
        this.name = 'GetAttrNode';
    }

    compile = (compiler) => {
        const nullSafe = this.nodes.attribute instanceof ConstantNode && this.nodes.attribute.isNullSafe;
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                compiler.compile(this.nodes.node)
                    .raw(nullSafe ? '?.' : '.')
                    .raw(this.nodes.attribute.attributes.value);
                break;
            case GetAttrNode.METHOD_CALL:
                compiler.compile(this.nodes.node)
                    .raw(nullSafe ? '?.' : '.')
                    .raw(this.nodes.attribute.attributes.value)
                    .raw('(')
                    .compile(this.nodes.fnArguments)
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
                let obj = this.nodes.node.evaluate(functions, values);
                if (null === obj && (this.nodes.attribute.isNullSafe || this.attributes.is_null_coalesce)) {
                    this.attributes.is_short_circuited = true;
                    return null;
                }
                if (null === obj && this.isShortCircuited()) {
                    return null;
                }

                if (typeof obj !== "object") {
                    throw new Error(`Unable to get property "${property}" on a non-object: ` + (typeof obj));
                }

                let property = this.nodes.attribute.attributes.value;
                if (this.attributes.is_null_coalesce) {
                    return obj[property] ?? null;
                }

                return obj[property];
            case GetAttrNode.METHOD_CALL:
                let obj2 = this.nodes.node.evaluate(functions, values);

                if (null === obj2 && this.nodes.attribute.isNullSafe) {
                    this.attributes.is_short_circuited = true;

                    return null;
                }

                if (null === obj2 && this.isShortCircuited()) {
                    return null;
                }

                let method = this.nodes.attribute.attributes.value;

                if (typeof obj2 !== 'object') {
                    throw new Error(`Unable to call method "${method}" on a non-object: ` + (typeof obj2));
                }
                if (obj2[method] === undefined) {
                    throw new Error(`Method "${method}" is undefined on object.`);
                }
                if (typeof obj2[method] != 'function') {
                    throw new Error(`Method "${method}" is not a function on object.`);
                }

                let evaluatedArgs = this.nodes.fnArguments.evaluate(functions, values);
                return obj2[method].apply(null, evaluatedArgs);
            case GetAttrNode.ARRAY_CALL:
                let array = this.nodes.node.evaluate(functions, values);
                if (null === array && this.isShortCircuited()) {
                    return null;
                }

                if (!Array.isArray(array) && typeof array !== 'object' && !(null === array && this.attributes.is_null_coalesce)) {
                    throw new Error(`Unable to get an item on a non-array: ` + typeof array);
                }

                if (this.attributes.is_null_coalesce) {
                    if (!array) {
                        return null;
                    }
                    return array[this.nodes.attribute.evaluate(functions, values)] ?? null;
                }

                return array[this.nodes.attribute.evaluate(functions, values)];
        }
    };

    isShortCircuited() {
        return this.attributes.is_short_circuited || (this.nodes.node instanceof GetAttrNode && this.nodes.node.isShortCircuited());
    }

    toArray = () => {
        const nullSafe = this.nodes.attribute instanceof ConstantNode && this.nodes.attribute.isNullSafe;
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                return [this.nodes.node, (nullSafe ? "?." : "."), this.nodes.attribute];
            case GetAttrNode.METHOD_CALL:
                return [this.nodes.node, (nullSafe ? "?." : "."), this.nodes.attribute, '(', this.nodes.fnArguments, ')'];
            case GetAttrNode.ARRAY_CALL:
                return [this.nodes.node, '[', this.nodes.attribute, ']'];
        }
    }
}
