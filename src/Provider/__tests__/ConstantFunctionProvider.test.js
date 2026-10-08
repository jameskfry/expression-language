import {ExpressionLanguage, ConstantFunctionProvider} from "../../index";
import LogicException from "../../LogicException";

const root = (typeof globalThis !== 'undefined') ? globalThis : global;

beforeAll(() => {
    root.TestApp = {
        Roles: {ADMIN: 'ROLE_ADMIN', USER: 'ROLE_USER', LEVEL: 3},
        Status: {Active: {kind: 'Status.Active'}, Inactive: {kind: 'Status.Inactive'}},
        Nested: {Deep: {Enum: {CaseA: {ok: true}}}},
    };
});

afterAll(() => {
    delete root.TestApp;
});

function el(allowed, customRoot = null) {
    return new ExpressionLanguage(null, [new ConstantFunctionProvider(allowed, customRoot)]);
}

function runCompiled(expression) {
    return new Function('return ' + el(['TestApp.*.*', 'Math.PI']).compile(expression) + ';')();
}

test('constant() returns an allowed constant', () => {
    const language = el(['Math.PI', 'TestApp.Roles.ADMIN']);

    expect(language.evaluate('constant("Math.PI")')).toBe(Math.PI);
    expect(language.evaluate('constant("TestApp.Roles.ADMIN")')).toBe('ROLE_ADMIN');
});

test('a constant that is not in the allow list is refused, whatever it is', () => {
    const language = el(['Math.PI']);

    expect(() => language.evaluate('constant("Math.E")')).toThrow('Constant "Math.E" is not allowed.');
    expect(() => language.evaluate('constant("process.env.HOME")')).toThrow('Constant "process.env.HOME" is not allowed.');
    expect(() => language.evaluate('constant("process")')).toThrow('is not allowed.');
    expect(() => language.evaluate('constant("globalThis")')).toThrow('is not allowed.');
    expect(() => language.evaluate('constant("")')).toThrow('is not allowed.');
});

test('with an empty allow list nothing can be read', () => {
    const language = el([]);

    expect(() => language.evaluate('constant("Math.PI")')).toThrow('is not allowed.');
    expect(() => language.evaluate('enum("Math.PI")')).toThrow('is not allowed.');
});

test('"*" matches within one path segment only', () => {
    const language = el(['TestApp.Roles.*', 'TestApp.Status.*']);

    expect(language.evaluate('constant("TestApp.Roles.USER")')).toBe('ROLE_USER');
    expect(language.evaluate('constant("TestApp.Roles.LEVEL")')).toBe(3);
    // `*` does not cross a "."
    expect(() => language.evaluate('constant("TestApp.Nested.Deep")')).toThrow('is not allowed.');
    expect(() => language.evaluate('constant("TestApp.Roles")')).toThrow('is not allowed.');
    expect(() => language.evaluate('constant("TestApp.Roles.")')).toThrow('is not allowed.');
});

test('a "*" inside a name matches a prefix', () => {
    const language = el(['TestApp.Roles.ROLE_*', 'TestApp.Roles.A*']);

    expect(language.evaluate('constant("TestApp.Roles.ADMIN")')).toBe('ROLE_ADMIN');
    expect(() => language.evaluate('constant("TestApp.Roles.USER")')).toThrow('is not allowed.');
});

test('names are case-sensitive', () => {
    expect(() => el(['Math.PI']).evaluate('constant("math.pi")')).toThrow('is not allowed.');
});

test('a constant that is allowed but does not exist is reported as undefined', () => {
    const language = el(['TestApp.Nope.*', 'Nowhere.At.All']);

    expect(() => language.evaluate('constant("TestApp.Nope.X")')).toThrow('Constant "TestApp.Nope.X" is not defined.');
    expect(() => language.evaluate('constant("Nowhere.At.All")')).toThrow('Constant "Nowhere.At.All" is not defined.');
});

test('only own properties are followed, so inherited members are out of reach even when allowed', () => {
    const language = el(['TestApp.*', 'TestApp.Roles.*', 'Math.*']);

    expect(() => language.evaluate('constant("TestApp.constructor")')).toThrow('is not defined.');
    expect(() => language.evaluate('constant("TestApp.Roles.toString")')).toThrow('is not defined.');
    expect(() => language.evaluate('constant("TestApp.__proto__")')).toThrow('is not defined.');
});

test('enum() resolves PHP style names and dotted names the same way', () => {
    const language = el(['TestApp.Status.*', 'TestApp.Nested.Deep.Enum.*']);

    expect(language.evaluate('enum("TestApp\\\\Status::Active")')).toEqual({kind: 'Status.Active'});
    expect(language.evaluate('enum("TestApp.Status.Inactive")')).toEqual({kind: 'Status.Inactive'});
    expect(language.evaluate('enum("TestApp::Nested::Deep::Enum::CaseA")')).toEqual({ok: true});
    expect(() => language.evaluate('enum("TestApp.Status.Pending")')).toThrow('Enum case "TestApp.Status.Pending" is not defined.');
    expect(() => language.evaluate('enum("TestApp.Roles.ADMIN")')).toThrow('Enum case "TestApp.Roles.ADMIN" is not allowed.');
});

test('the name has to be a string', () => {
    expect(() => el(['Math.PI']).evaluate('constant(123)')).toThrow('Constant name must be a string.');
    expect(() => el(['Math.PI']).evaluate('enum(null)')).toThrow('Enum case name must be a string.');
});

test('a custom root replaces the global object', () => {
    const Colors = {RED: '#f00', nested: {BLUE: '#00f'}};
    const language = el(['Colors.*', 'Colors.nested.*'], {Colors});

    expect(language.evaluate('constant("Colors.RED")')).toBe('#f00');
    expect(language.evaluate('constant("Colors.nested.BLUE")')).toBe('#00f');
    expect(() => language.evaluate('constant("Math.PI")')).toThrow('is not allowed.');
    expect(() => language.compile('constant("Colors.RED")')).toThrow(LogicException);
});

test('the allow list has to be an array', () => {
    expect(() => new ConstantFunctionProvider('Math.PI')).toThrow(TypeError);
});

test('compiled code resolves and checks constants like evaluate() does', () => {
    expect(runCompiled('constant("Math.PI")')).toBe(Math.PI);
    expect(runCompiled('constant("TestApp.Roles.ADMIN")')).toBe('ROLE_ADMIN');
    expect(runCompiled('enum("TestApp.Status.Active")')).toEqual({kind: 'Status.Active'});
});

test('compiled code enforces the allow list at runtime, including for a dynamic name', () => {
    const language = el(['Math.PI', 'TestApp.Roles.*']);
    const run = (expression, values = {}) => new Function(...Object.keys(values), 'return ' + language.compile(expression, Object.keys(values)) + ';')(...Object.values(values));

    expect(run('constant(name)', {name: 'TestApp.Roles.USER'})).toBe('ROLE_USER');
    expect(() => run('constant(name)', {name: 'process.env.HOME'})).toThrow('is not allowed.');
    expect(() => run('constant("process")')).toThrow('is not allowed.');
    expect(() => run('enum("TestApp.Roles.NOPE")')).toThrow('is not defined.');
});
