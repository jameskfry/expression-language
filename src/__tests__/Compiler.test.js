import Compiler from "../Compiler";

test('getFunction looks up a registered function by name', () => {
    let compiler = new Compiler({foo: {compiler: () => 'foo()', evaluator: () => 1}});
    expect(compiler.getFunction('foo').evaluator()).toBe(1);
});

test('raw appends to the source and getSource/reset expose and clear it', () => {
    let compiler = new Compiler({});
    compiler.raw('abc').raw('def');

    expect(compiler.getSource()).toBe('abcdef');
    expect(compiler.reset()).toBe(compiler);
    expect(compiler.getSource()).toBe('');
});

test('compile delegates to the node and returns the compiler for chaining', () => {
    let compiler = new Compiler({});
    let node = {compile: jest.fn()};

    expect(compiler.compile(node)).toBe(compiler);
    expect(node.compile).toHaveBeenCalledWith(compiler);
});

test('subcompile isolates and restores the current source', () => {
    let compiler = new Compiler({});
    compiler.raw('outer-');

    let node = {compile: (c) => c.raw('inner')};
    let result = compiler.subcompile(node);

    expect(result).toBe('inner');
    expect(compiler.getSource()).toBe('outer-');
});

test('string quotes and escapes the value', () => {
    let compiler = new Compiler({});
    compiler.string('say "hi"');
    expect(compiler.getSource()).toBe('"say \\"hi\\""');
});

test('repr writes identifiers raw, without quoting', () => {
    let compiler = new Compiler({});
    compiler.repr('someIdentifier', true);
    expect(compiler.getSource()).toBe('someIdentifier');
});

test('repr writes integers and floats raw', () => {
    let compiler = new Compiler({});
    compiler.repr(42);
    expect(compiler.getSource()).toBe('42');

    let compiler2 = new Compiler({});
    compiler2.repr(3.14);
    expect(compiler2.getSource()).toBe('3.14');
});

test('repr writes null and booleans as literals', () => {
    let compiler = new Compiler({});
    compiler.repr(null).raw(',').repr(true).raw(',').repr(false);
    expect(compiler.getSource()).toBe('null,true,false');
});

test('repr writes arrays using array literal syntax', () => {
    let compiler = new Compiler({});
    compiler.repr([1, 'two', true]);
    expect(compiler.getSource()).toBe('[1, "two", true]');
});

test('repr writes plain objects using object literal syntax', () => {
    let compiler = new Compiler({});
    compiler.repr({a: 1, b: 'two'});
    expect(compiler.getSource()).toBe('{"a":1, "b":"two"}');
});

test('repr writes strings quoted', () => {
    let compiler = new Compiler({});
    compiler.repr('hello');
    expect(compiler.getSource()).toBe('"hello"');
});
