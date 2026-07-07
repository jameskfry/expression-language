import ExpressionLanguage from "../../ExpressionLanguage";
import DateProvider from "../DateProvider";
import {date} from "locutus/php/datetime/date";
import {strtotime} from "locutus/php/datetime/strtotime";

test('date evaluate', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('date("Y-m-d")');
    expect(result).toBe(date("Y-m-d"));
});

test('strtotime evaluate', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('strtotime("yesterday")');
    expect(result).toBe(strtotime("yesterday"));
});

test('date compile without timestamp', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('date("Y-m-d")');
    expect(result).toBe('date("Y-m-d")');
});

test('date evaluate with timestamp', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('date("Y-m-d", 0)');
    expect(result).toBe(date("Y-m-d", 0));
});

test('date compile with timestamp', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('date("Y-m-d", 0)');
    expect(result).toBe('date("Y-m-d", 0)');
});

test('strtotime compile without now', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('strtotime("yesterday")');
    expect(result).toBe('strtotime("yesterday")');
});

test('strtotime evaluate with now', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.evaluate('strtotime("+1 day", 0)');
    expect(result).toBe(strtotime("+1 day", 0));
});

test('strtotime compile with now', () => {
    let el = new ExpressionLanguage(null, [new DateProvider()]);
    let result = el.compile('strtotime("+1 day", 0)');
    expect(result).toBe('strtotime("+1 day", 0)');
});
