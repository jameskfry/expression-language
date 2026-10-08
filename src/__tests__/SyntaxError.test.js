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

test('the position, the expression and the hint are part of the message itself, like Symfony\'s', () => {
    let error = new SyntaxError('Variable "fo" is not valid', 1, 'fo', 'fo', ['foo', 'bar']);

    expect(error.message).toBe('Variable "fo" is not valid around position 1 for expression `fo`. Did you mean "foo"?');
    expect(error.name).toBe('SyntaxError');
    expect(error.cursor).toBe(1);
    expect(error.expression).toBe('fo');
    expect(error.subject).toBe('fo');
    expect(error.proposals).toEqual(['foo', 'bar']);
});

test('trailing dots of the message are not repeated before the position', () => {
    expect(new SyntaxError('Unexpected token...', 2).message).toBe('Unexpected token around position 2.');
});

test('the position defaults to 0 and the expression to nothing', () => {
    expect(new SyntaxError('Oops').message).toBe('Oops around position 0.');
});
