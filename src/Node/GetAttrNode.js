import Node from "./Node";
import ConstantNode from "./ConstantNode";
import {assertAccessible} from "../lib/guard";

const dumpOf = (node) => {
    try {
        return node.dump();
    } catch (e) {
        return node.name;
    }
};

const typeOf = (value) => {
    if (null === value) {
        return 'null';
    }
    if (typeof value === 'object' && value.constructor && value.constructor.name) {
        return value.constructor.name;
    }
    return typeof value;
};

export default class GetAttrNode extends Node {
    static PROPERTY_CALL = 1;
    static METHOD_CALL = 2;
    static ARRAY_CALL = 3;

    /**
     * @param {Node} node
     * @param {Node} attribute
     * @param {Node} fnArguments
     * @param {number} type One of PROPERTY_CALL, METHOD_CALL or ARRAY_CALL
     * @param {boolean} isNullSafe Whether the access uses the `?.[]` operator; only honored for ARRAY_CALL.
     *                             For PROPERTY_CALL and METHOD_CALL, null-safety is driven by ConstantNode#isNullSafe.
     * @param {'symfony'|'js'|'portable'} semantics With the "js" rules an array has properties and methods (`list.length`),
     *                             with the others it is not an object, as in PHP (symfony: the default)
     */
    constructor(node, attribute, fnArguments, type, isNullSafe = false, semantics = 'symfony') {
        super(
            {node: node, attribute: attribute, fnArguments: fnArguments},
            {type: type, is_null_coalesce: false, is_null_safe: GetAttrNode.ARRAY_CALL === type && isNullSafe}
        );
        if ('symfony' !== semantics) {
            this.attributes.semantics = semantics;
        }
        this.name = 'GetAttrNode';
    }

    compile = (compiler) => {
        const nullSafe = (this.nodes.attribute instanceof ConstantNode && this.nodes.attribute.isNullSafe) || this.attributes.is_null_safe;
        // Inside a `??` every link of the chain may be missing, which optional chaining expresses directly
        const optional = nullSafe || this.attributes.is_null_coalesce;

        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                compiler.compile(this.nodes.node)
                    .raw(optional ? '?.' : '.')
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
                    .raw(optional ? '?.[' : '[')
                    .compile(this.nodes.attribute)
                    .raw(']');
                break;
        }
    };

    evaluate = (functions, values) => {
        return this.evaluateChain(functions, values, {shortCircuited: false});
    };

    /**
     * Evaluates the chain of accesses this node ends, sharing (per evaluation, never on the node)
     * whether a null-safe operator short-circuited it.
     */
    evaluateChain = (functions, values, state) => {
        const node = this.nodes.node;
        const value = node instanceof GetAttrNode ? node.evaluateChain(functions, values, state) : node.evaluate(functions, values);

        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL: {
                if (null === value && (this.nodes.attribute.isNullSafe || this.attributes.is_null_coalesce)) {
                    state.shortCircuited = true;
                    return null;
                }
                if (null === value && state.shortCircuited) {
                    return null;
                }

                if (null === value || typeof value !== 'object' || this.isArrayInPhp(value)) {
                    throw new Error(`Unable to get property "${dumpOf(this.nodes.attribute)}" of non-object "${dumpOf(node)}".`);
                }

                const property = this.nodes.attribute.attributes.value;
                assertAccessible(value, property);

                if (this.attributes.is_null_coalesce) {
                    return value[property] ?? null;
                }

                return value[property];
            }
            case GetAttrNode.METHOD_CALL: {
                if (null === value && this.nodes.attribute.isNullSafe) {
                    state.shortCircuited = true;
                    return null;
                }
                if (null === value && state.shortCircuited) {
                    return null;
                }

                if (null === value || typeof value !== 'object' || this.isArrayInPhp(value)) {
                    throw new Error(`Unable to call method "${dumpOf(this.nodes.attribute)}" of non-object "${dumpOf(node)}".`);
                }

                const method = this.nodes.attribute.attributes.value;
                assertAccessible(value, method);
                if (typeof value[method] !== 'function') {
                    throw new Error(`Unable to call method "${method}" of object "${typeOf(value)}".`);
                }

                // Called on the object itself, so methods can rely on `this`
                return value[method].apply(value, this.nodes.fnArguments.evaluate(functions, values));
            }
            case GetAttrNode.ARRAY_CALL: {
                if (null === value && (this.attributes.is_null_safe || state.shortCircuited)) {
                    state.shortCircuited = true;
                    return null;
                }

                if (null === value && this.attributes.is_null_coalesce) {
                    return null;
                }

                if (null === value || typeof value !== 'object') {
                    throw new Error(`Unable to get an item of non-array "${dumpOf(node)}".`);
                }

                const key = this.nodes.attribute.evaluate(functions, values);
                assertAccessible(value, key);

                if (this.attributes.is_null_coalesce) {
                    return value[key] ?? null;
                }

                return value[key];
            }
        }
    };

    /**
     * In PHP an array is not an object, so it has no properties nor methods (JavaScript's `list.length`, `list.includes()`).
     */
    isArrayInPhp(value) {
        return 'js' !== (this.attributes.semantics ?? 'symfony') && Array.isArray(value);
    }

    toArray = () => {
        const nullSafe = this.nodes.attribute instanceof ConstantNode && this.nodes.attribute.isNullSafe;
        switch(this.attributes.type) {
            case GetAttrNode.PROPERTY_CALL:
                return [this.nodes.node, (nullSafe ? "?." : "."), this.nodes.attribute];
            case GetAttrNode.METHOD_CALL:
                return [this.nodes.node, (nullSafe ? "?." : "."), this.nodes.attribute, '(', this.nodes.fnArguments, ')'];
            case GetAttrNode.ARRAY_CALL:
                return [this.nodes.node, this.attributes.is_null_safe ? '?.[' : '[', this.nodes.attribute, ']'];
        }
    }
}
