import Expression from "./Expression";
import Node from "./Node/Node";
import ConstantNode from "./Node/ConstantNode";
import NameNode from "./Node/NameNode";
import FunctionNode from "./Node/FunctionNode";
import UnaryNode from "./Node/UnaryNode";
import BinaryNode from "./Node/BinaryNode";
import GetAttrNode from "./Node/GetAttrNode";
import ArrayNode from "./Node/ArrayNode";
import ArgumentsNode from "./Node/ArgumentsNode";
import ConditionalNode from "./Node/ConditionalNode";
import NullCoalesceNode from "./Node/NullCoalesceNode";
import NullCoalescedNameNode from "./Node/NullCoalescedNameNode";

export default class ParsedExpression extends Expression {
    constructor(expression, nodes) {
        super(expression);
        this.nodes = nodes;
    }

    getNodes = () => {
        return this.nodes;
    }

    static fromJSON(json) {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;

        const buildNode = (n) => {
            if (n === null || n === undefined) {
                return n;
            }
            // If it's already an instance (unlikely when parsing from plain JSON), return as-is
            if (n instanceof Node) {
                return n;
            }
            // If it doesn't look like a Node, return as-is
            if (typeof n !== 'object' || !n.name) {
                return n;
            }

            switch (n.name) {
                case 'ConstantNode': {
                    return new ConstantNode(n.attributes?.value, !!n.isIdentifier, !!n.isNullSafe);
                }
                case 'NameNode': {
                    return new NameNode(n.attributes?.name);
                }
                case 'NullCoalescedNameNode': {
                    return new NullCoalescedNameNode(n.attributes?.name);
                }
                case 'UnaryNode': {
                    return new UnaryNode(n.attributes?.operator, buildNode(n.nodes?.node));
                }
                case 'BinaryNode': {
                    return new BinaryNode(n.attributes?.operator, buildNode(n.nodes?.left), buildNode(n.nodes?.right));
                }
                case 'ConditionalNode': {
                    return new ConditionalNode(buildNode(n.nodes?.expr1), buildNode(n.nodes?.expr2), buildNode(n.nodes?.expr3));
                }
                case 'NullCoalesceNode': {
                    return new NullCoalesceNode(buildNode(n.nodes?.expr1), buildNode(n.nodes?.expr2));
                }
                case 'ArgumentsNode': {
                    const argsNode = new ArgumentsNode();
                    // Preserve internal state if present
                    if (typeof n.type === 'string') argsNode.type = n.type;
                    if (typeof n.index === 'number') argsNode.index = n.index;
                    if (typeof n.keyIndex === 'number') argsNode.keyIndex = n.keyIndex;
                    argsNode.nodes = {};
                    for (const key of Object.keys(n.nodes || {})) {
                        argsNode.nodes[key] = buildNode(n.nodes[key]);
                    }
                    return argsNode;
                }
                case 'ArrayNode': {
                    const arrNode = new ArrayNode();
                    if (typeof n.type === 'string') arrNode.type = n.type;
                    if (typeof n.index === 'number') arrNode.index = n.index;
                    if (typeof n.keyIndex === 'number') arrNode.keyIndex = n.keyIndex;
                    arrNode.nodes = {};
                    for (const key of Object.keys(n.nodes || {})) {
                        arrNode.nodes[key] = buildNode(n.nodes[key]);
                    }
                    return arrNode;
                }
                case 'FunctionNode': {
                    const args = buildNode(n.nodes?.arguments);
                    return new FunctionNode(n.attributes?.name, args);
                }
                case 'GetAttrNode': {
                    const node = new GetAttrNode(
                        buildNode(n.nodes?.node),
                        buildNode(n.nodes?.attribute),
                        buildNode(n.nodes?.fnArguments),
                        n.attributes?.type
                    );
                    // restore flags if present
                    if (n.attributes && typeof n.attributes.is_null_coalesce === 'boolean') {
                        node.attributes.is_null_coalesce = n.attributes.is_null_coalesce;
                    }
                    if (n.attributes && typeof n.attributes.is_short_circuited === 'boolean') {
                        node.attributes.is_short_circuited = n.attributes.is_short_circuited;
                    }
                    return node;
                }
                case 'Node': {
                    // Generic container Node used by Parser for argument lists
                    const generic = new Node();
                    if (Array.isArray(n.nodes)) {
                        // Convert array to object with numeric keys to match original
                        generic.nodes = n.nodes.map(buildNode);
                    } else {
                        generic.nodes = {};
                        for (const key of Object.keys(n.nodes || {})) {
                            generic.nodes[key] = buildNode(n.nodes[key]);
                        }
                    }
                    // Restore attributes if any
                    generic.attributes = n.attributes || {};
                    return generic;
                }
                default: {
                    // Fallback: try to reconstruct as a generic Node
                    const generic = new Node();
                    generic.name = n.name;
                    // children
                    if (Array.isArray(n.nodes)) {
                        generic.nodes = n.nodes.map(buildNode);
                    } else {
                        generic.nodes = {};
                        for (const key of Object.keys(n.nodes || {})) {
                            generic.nodes[key] = buildNode(n.nodes[key]);
                        }
                    }
                    generic.attributes = n.attributes || {};
                    return generic;
                }
            }
        };

        const buildNodesContainer = (nodesData) => {
            if (nodesData === null || nodesData === undefined) {
                return nodesData;
            }
            // Single node object
            if (nodesData.name) {
                return buildNode(nodesData);
            }
            // Array of nodes
            if (Array.isArray(nodesData)) {
                return nodesData.map(buildNode);
            }
            // Object map of nodes
            if (typeof nodesData === 'object') {
                const out = {};
                for (const key of Object.keys(nodesData)) {
                    out[key] = buildNode(nodesData[key]);
                }
                return out;
            }
            return nodesData;
        };

        const expression = obj.expression;
        const nodes = buildNodesContainer(obj.nodes);
        return new ParsedExpression(expression, nodes);
    }
}