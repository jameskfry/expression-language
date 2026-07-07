import SyntaxError from "../SyntaxError";

test('toString includes the expression when one is provided', () => {
    let error = new SyntaxError('Unexpected token', 3, 'foo.bar');
    expect(error.toString()).toBe('SyntaxError: Unexpected token around position 3 for expression `foo.bar`.');
});

test('toString omits the expression clause when none is provided', () => {
    let error = new SyntaxError('Unexpected token', 3);
    expect(error.toString()).toBe('SyntaxError: Unexpected token around position 3.');
});

test('toString suggests the closest proposal when the subject is a close match', () => {
    let error = new SyntaxError('Variable "fo" is not valid', 1, 'fo', 'fo', ['foo', 'bar']);
    expect(error.toString()).toContain('Did you mean "foo"?');
});

test('toString suggests nothing when no proposal is close enough', () => {
    let error = new SyntaxError('Variable "xyz" is not valid', 1, 'xyz', 'xyz', ['foo', 'bar']);
    expect(error.toString()).not.toContain('Did you mean');
});
