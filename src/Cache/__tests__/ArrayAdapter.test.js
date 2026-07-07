import ArrayAdapter, {CacheItem} from "../ArrayAdapter";

test('getItem returns a miss for an unknown key', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');

    expect(item.isHit).toBe(false);
    expect(item.get()).toBeNull();
});

test('save then getItem returns a hit with the saved value', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');

    expect(adapter.save(item)).toBe(true);

    let hit = adapter.getItem('foo');
    expect(hit.isHit).toBe(true);
    expect(hit.get()).toBe('bar');
});

test('save returns false for a non-CacheItem argument', () => {
    let adapter = new ArrayAdapter();
    expect(adapter.save({key: 'foo', value: 'bar'})).toBe(false);
    expect(adapter.getItem('foo').isHit).toBe(false);
});

test('save of an already-expired item deletes it and reports success', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');
    item.expiresAt(new Date(0));

    expect(adapter.save(item)).toBe(true);
    expect(adapter.getItem('foo').isHit).toBe(false);
});

test('save applies defaultLifetime when the item has no explicit expiry', () => {
    let adapter = new ArrayAdapter(3600);
    let item = adapter.getItem('foo');
    item.set('bar');

    adapter.save(item);

    expect(adapter.hasItem('foo')).toBe(true);
    expect(adapter.getValues().foo).toBe('bar');
});

test('saveDeferred behaves like save', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');

    expect(adapter.saveDeferred(item)).toBe(true);
    expect(adapter.getItem('foo').get()).toBe('bar');
});

test('commit always returns true', () => {
    let adapter = new ArrayAdapter();
    expect(adapter.commit()).toBe(true);
});

test('get computes and caches the value via the callback on a miss', () => {
    let adapter = new ArrayAdapter();
    let calls = 0;
    let compute = (item, save) => {
        calls++;
        return 'computed';
    };

    expect(adapter.get('foo', compute)).toBe('computed');
    expect(calls).toBe(1);

    // Second call should be a hit and must not invoke the callback again.
    expect(adapter.get('foo', compute)).toBe('computed');
    expect(calls).toBe(1);
});

test('delete removes a stored item', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');
    adapter.save(item);

    expect(adapter.delete('foo')).toBe(true);
    expect(adapter.getItem('foo').isHit).toBe(false);
});

test('deleteItems removes multiple keys', () => {
    let adapter = new ArrayAdapter();
    for (let key of ['a', 'b', 'c']) {
        let item = adapter.getItem(key);
        item.set(key.toUpperCase());
        adapter.save(item);
    }

    expect(adapter.deleteItems(['a', 'b'])).toBe(true);
    expect(adapter.hasItem('a')).toBe(false);
    expect(adapter.hasItem('b')).toBe(false);
    expect(adapter.hasItem('c')).toBe(true);
});

test('getItems returns a CacheItem per key, hit or miss', () => {
    let adapter = new ArrayAdapter();
    let known = adapter.getItem('known');
    known.set('value');
    adapter.save(known);

    let items = adapter.getItems(['known', 'unknown']);

    expect(items.known.isHit).toBe(true);
    expect(items.known.get()).toBe('value');
    expect(items.unknown.isHit).toBe(false);
});

test('getItems validates non-string keys that have not been seen before', () => {
    let adapter = new ArrayAdapter();
    expect(() => adapter.getItems([42])).toThrow('Cache key must be string');
});

test('getValues returns the internal values map', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');
    adapter.save(item);

    expect(adapter.getValues()).toEqual({foo: 'bar'});
});

test('hasItem is false before saving and true after', () => {
    let adapter = new ArrayAdapter();
    expect(adapter.hasItem('foo')).toBe(false);

    let item = adapter.getItem('foo');
    item.set('bar');
    adapter.save(item);

    expect(adapter.hasItem('foo')).toBe(true);
});

test('clear empties all values and expiries', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');
    adapter.save(item);

    expect(adapter.clear()).toBe(true);
    expect(adapter.getValues()).toEqual({});
    expect(adapter.hasItem('foo')).toBe(false);
});

test('reset clears the adapter', () => {
    let adapter = new ArrayAdapter();
    let item = adapter.getItem('foo');
    item.set('bar');
    adapter.save(item);

    adapter.reset();

    expect(adapter.hasItem('foo')).toBe(false);
});

test('deleteItem/hasItem validate the key and reject invalid keys', () => {
    let adapter = new ArrayAdapter();

    expect(() => adapter.hasItem(42)).toThrow('Cache key must be string');
    expect(() => adapter.hasItem('')).toThrow('Cache key length must be greater than zero');
    expect(() => adapter.hasItem('foo{bar}')).toThrow('contains reserved character');
    expect(() => adapter.deleteItem(42)).toThrow('Cache key must be string');
});

test('CacheItem getKey/get/set', () => {
    let item = new CacheItem();
    item.key = 'foo';
    item.set('bar');

    expect(item.getKey()).toBe('foo');
    expect(item.get()).toBe('bar');
});

test('CacheItem.set returns the item for chaining', () => {
    let item = new CacheItem();
    expect(item.set('value')).toBe(item);
});

test('CacheItem.expiresAt accepts null, a Date, or throws otherwise', () => {
    let item = new CacheItem();
    item.defaultLifetime = 100;

    expect(item.expiresAt(null)).toBe(item);
    expect(item.expiry).toBeGreaterThan(Date.now() / 1000);

    let withoutDefaultLifetime = new CacheItem();
    withoutDefaultLifetime.expiresAt(null);
    expect(withoutDefaultLifetime.expiry).toBeNull();

    let atDate = new CacheItem();
    let when = new Date('2020-01-01T00:00:00Z');
    atDate.expiresAt(when);
    expect(atDate.expiry).toBe(when.getTime() / 1000);

    let invalid = new CacheItem();
    expect(() => invalid.expiresAt('not-a-date')).toThrow('Expiration date must be instance of Date');
});

test('CacheItem.expiresAfter accepts null, an integer, or throws otherwise', () => {
    let item = new CacheItem();
    item.defaultLifetime = 100;

    expect(item.expiresAfter(null)).toBe(item);
    expect(item.expiry).toBeGreaterThan(Date.now() / 1000);

    let withoutDefaultLifetime = new CacheItem();
    withoutDefaultLifetime.expiresAfter(null);
    expect(withoutDefaultLifetime.expiry).toBeNull();

    let afterSeconds = new CacheItem();
    let before = Date.now() / 1000;
    afterSeconds.expiresAfter(60);
    expect(afterSeconds.expiry).toBeGreaterThanOrEqual(before + 60);

    let invalid = new CacheItem();
    expect(() => invalid.expiresAfter('soon')).toThrow('Expiration date must be an integer');
});

test('CacheItem.tag throws on a non-tag-aware (non-taggable) pool item', () => {
    let item = new CacheItem();
    expect(item.isTaggable).toBe(false);
    expect(() => item.tag('some-tag')).toThrow('comes from a non tag-aware pool');
});

test('CacheItem.tag is broken for taggable items: newMetadata.tags is never initialized', () => {
    // Nothing in this codebase ever sets isTaggable = true, so this path is currently unreachable
    // through the public API. Forcing it here documents a real latent bug (this.newMetadata.tags
    // is never initialized to an object in the constructor), so tagging a taggable item throws
    // instead of recording the tag.
    let item = new CacheItem();
    item.isTaggable = true;

    expect(() => item.tag('some-tag')).toThrow(TypeError);
});

test('CacheItem.getMetadata returns the metadata object', () => {
    let item = new CacheItem();
    expect(item.getMetadata()).toEqual({});
});

test('CacheItem.validateKey rejects non-strings, empty strings, and reserved characters', () => {
    expect(() => CacheItem.validateKey(42)).toThrow('Cache key must be string');
    expect(() => CacheItem.validateKey('')).toThrow('Cache key length must be greater than zero');
    for (let reserved of ["{", "}", "(", ")", "/", "\\", "@", ":"]) {
        expect(() => CacheItem.validateKey(`foo${reserved}bar`)).toThrow('contains reserved character');
    }
    expect(CacheItem.validateKey('valid-key')).toBe('valid-key');
});
