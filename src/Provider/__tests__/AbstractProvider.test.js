import AbstractProvider from "../AbstractProvider";

test('getFunctions throws when not overridden', () => {
    let provider = new AbstractProvider();
    expect(() => provider.getFunctions()).toThrow("getFunctions must be implemented by AbstractProvider");
});

test('getFunctions error names the concrete subclass when a subclass fails to override it', () => {
    class CustomProvider extends AbstractProvider {}
    let provider = new CustomProvider();
    expect(() => provider.getFunctions()).toThrow("getFunctions must be implemented by CustomProvider");
});
