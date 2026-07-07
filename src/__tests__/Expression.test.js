import Expression from "../Expression";

test('toString returns the wrapped expression string', () => {
    let expression = new Expression('1 + 2');
    expect(expression.toString()).toBe('1 + 2');
});
