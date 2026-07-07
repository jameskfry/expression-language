import LogicException from "../LogicException";

test('is an Error subclass with a LogicException name', () => {
    let error = new LogicException('something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LogicException');
    expect(error.message).toBe('something went wrong');
});

test('toString formats the name and message', () => {
    let error = new LogicException('something went wrong');
    expect(error.toString()).toBe('LogicException: something went wrong');
});
