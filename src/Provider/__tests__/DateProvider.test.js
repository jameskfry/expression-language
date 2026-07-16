import ExpressionLanguage from "../../ExpressionLanguage";
import DateProvider from "../DateProvider";
import {date} from "locutus/php/datetime/date";
import {strtotime} from "locutus/php/datetime/strtotime";
import compileRuntime from "../../CompileRuntime";

test('date evaluate', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('date("Y-m-d")');
    expect(result).toBe(date("Y-m-d"));
});

test('date compile', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let compiled = el.compile('date("Y-m-d")');
    expect(compiled).toBe('__runtime.date("Y-m-d")');

    let fn = new Function('__runtime', 'return ' + compiled + ';');
    expect(fn(compileRuntime)).toBe(date("Y-m-d"));
});

test('strtotime evaluate', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('strtotime("yesterday")');
    expect(result).toBe(strtotime("yesterday"));
});

test('date evaluate with timestamp', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('date("Y-m-d", 0)');
    expect(result).toBe(date("Y-m-d", 0));
});

test('date compile with timestamp', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('date("Y-m-d", 0)');
    expect(result).toBe('__runtime.date("Y-m-d", 0)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe(date("Y-m-d", 0));
});

test('strtotime compile', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let compiled = el.compile('strtotime("yesterday")');
    expect(compiled).toBe('__runtime.strtotime("yesterday")');

    let fn = new Function('__runtime', 'return ' + compiled + ';');
    expect(fn(compileRuntime)).toBe(strtotime("yesterday"));
});

test('strtotime evaluate with now', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('strtotime("+1 day", 0)');
    expect(result).toBe(strtotime("+1 day", 0));
});

test('strtotime compile with now', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('strtotime("+1 day", 0)');
    expect(result).toBe('__runtime.strtotime("+1 day", 0)');

    let fn = new Function('__runtime', 'return ' + result + ';');
    expect(fn(compileRuntime)).toBe(strtotime("+1 day", 0));
});
