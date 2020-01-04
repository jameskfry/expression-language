import Node from "./Node";

export default class FunctionNode extends Node {
    constructor(name, _arguments) {
        //console.log("Creating function node: ", name, _arguments);
        super({arguments: _arguments}, {name: name});
        this.name = 'FunctionNode';
    }

    compile = (compiler) => {
        let _arguments = [];
        for (let node of Object.values(this.nodes.arguments.nodes)) {
            _arguments.push(compiler.subcompile(node));
        }

        let fn = compiler.getFunction(this.attributes.name);

        compiler.raw(fn.compiler.apply(null, _arguments));
    };

    evaluate = (functions, values) => {
        let _arguments = [values];
        for (let node of Object.values(this.nodes.arguments.nodes)) {
            //console.log("Testing: ", node, functions, values);
            _arguments.push(node.evaluate(functions, values));
        }

        return functions[this.attributes.name]['evaluator'].apply(null, _arguments);
    };

    toArray() {
        let array = [];
        array.push(this.attributes.name);

        for (let node of Object.values(this.nodes.arguments.nodes)) {
            array.push(', ');
            array.push(node);
        }

        array[1] = '(';
        array.push(')');

        return array;
    }
}