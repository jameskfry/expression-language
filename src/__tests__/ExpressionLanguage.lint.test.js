import {IGNORE_UNKNOWN_FUNCTIONS, IGNORE_UNKNOWN_VARIABLES} from "../Parser";
import ExpressionLanguage from "../ExpressionLanguage";

/**
 * Tests for ExpressionLanguage.lint and using flags through the high-level API
 */
describe('ExpressionLanguage.lint and flags', () => {
    test('lint passes for valid expression', () => {
        const el = new ExpressionLanguage();
        el.lint('foo["some_key"].callFunction(a ? b)', ['foo', 'a', 'b']);
    });

    test('lint throws by default for unknown variable and function', () => {
        const el = new ExpressionLanguage();
        expect(() => el.lint('myFn(foo)')).toThrow();
    });

    test('lint allows unknown variables when flag is set', () => {
        const el = new ExpressionLanguage();
        el.lint('foo.bar', [], IGNORE_UNKNOWN_VARIABLES);
    });

    test('lint allows unknown functions when flag is set', () => {
        const el = new ExpressionLanguage();
        el.lint('foo()', [], IGNORE_UNKNOWN_FUNCTIONS);
    });

    test('lint allows both unknown function and variable when both flags set', () => {
        const el = new ExpressionLanguage();
        el.lint('foo(bar)', [], IGNORE_UNKNOWN_FUNCTIONS | IGNORE_UNKNOWN_VARIABLES);
    });

    test('lint supports deprecated null names by converting to IGNORE_UNKNOWN_VARIABLES', () => {
        const el = new ExpressionLanguage();
        // Should not throw because names === null maps to IGNORE_UNKNOWN_VARIABLES internally
        el.lint('foo.bar', null, 0);
    });
});
