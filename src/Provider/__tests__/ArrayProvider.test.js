import ExpressionLanguage from "../../ExpressionLanguage";
import ArrayProvider from "../ArrayProvider";

test('implode evaluate', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.evaluate('implode(". ", ["check", "this", "out"])');
    expect(result).toBe("check. this. out");
});

test('implode compile', () => {
    let el = new ExpressionLanguage(null, [new ArrayProvider()]);
    let result = el.compile('implode(". ", ["check", "this", "out"])');
    expect(result).toBe('implode(". ", ["check", "this", "out"])');
});