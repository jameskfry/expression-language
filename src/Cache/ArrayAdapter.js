export default class ArrayAdapter {

    constructor(defaultLifetime = 0) {
        this.defaultLifetime = defaultLifetime;
        this.values = {};
        this.expiries = {};
    }

    createCacheItem = (key, value, isHit) => {
        let item = new CacheItem();
        item.key = key;
        item.value = value;
        item.isHit = isHit;
        item.defaultLifetime = this.defaultLifetime;

        return item;
    };

    get = (key, callback, beta = null, metadata = null) => {
        let item = this.getItem(key);
        if (!item.isHit) {
            let save = true;
            this.save(item.set(callback(item, save)));
        }
        return item.get();
    };

    getItem = (key) => {
        let isHit = this.hasItem(key),
            value = null;
        if (!isHit) {
            this.values[key] = null;
        }
        else {
            value = this.values[key];
        }
        let f = this.createCacheItem;

        return f(key, value, isHit);
    };

    getItems = (keys) => {
        for (let key of keys) {
            if (typeof key !== "string" && !this.expiries[key]) {
                CacheItem.validateKey(key);
            }
        }

        return this.generateItems(keys, ((new Date).getTime() / 1000), this.createCacheItem);
    };

    deleteItems = (keys) => {
        for (let key of keys) {
            this.deleteItem(key);
        }

        return true;
    };

    save = (item) => {
        if (!item instanceof CacheItem) {
            return false;
        }

        if (item.expiry !== null && item.expiry <= ((new Date).getTime() / 1000)) {
            this.deleteItem(item.key);

            return true;
        }
        if (null === item.expiry && 0 < item.defaultLifetime) {
            item.expiry = ((new Date()).getTime() / 1000) + item.defaultLifetime;
        }
        this.values[item.key] = item.value;
        this.expiries[item.key] = item.expiry || Number.MAX_SAFE_INTEGER;

        return true;
    };

    saveDeferred = (item) => {
        return this.save(item);
    };

    commit = () => {
        return true;
    };

    delete = (key) => {
        return this.deleteItem(key);
    };

    getValues = () => {
        return this.values;
    };

    hasItem = (key) => {
        if (typeof key === "string" && this.expiries[key] && this.expiries[key] > ((new Date).getTime() / 1000)) {
            return true;
        }
        CacheItem.validateKey(key);

        return !!this.expiries[key] && !this.deleteItem(key);
    };

    clear = () => {
        this.values = {};
        this.expiries = {};
        return true;
    };

    deleteItem = (key) => {
        if (typeof key !== "string" || !this.expiries[key]) {
            CacheItem.validateKey(key);
        }
        delete this.values[key];
        delete this.expiries[key];

        return true;
    };

    reset = () => {
        this.clear();
    };

    generateItems = (keys, now, f) => {
        let generated = [];
        for (let key of keys) {
            let value = null;
            let isHit = !!this.expiries[key];
            if (!isHit && (this.expiries[key] > now || !this.deleteItem(key))) {
                this.values[key] = null;
            }
            else {
                value = this.values[key];
            }

            generated[key] = f(key, value, isHit);
        }

        return generated;
    };
}

export class CacheItem {
    static METADATA_EXPIRY_OFFSET = 1527506807;
    static RESERVED_CHARACTERS = ["{", "}", "(", ")", "/", "\\", "@", ":"];

    constructor() {
        this.key = null;
        this.value = null;
        this.isHit = false;
        this.expiry = null;
        this.defaultLifetime = null;
        this.metadata = {};
        this.newMetadata = {};
        this.innerItem = null;
        this.poolHash = null;
        this.isTaggable = false;
    }

    getKey = () => {
        return this.key;
    };

    get = () => {
        return this.value;
    };

    set = (value) => {
        this.value = value;
        return this;
    };

    expiresAt = (expiration) => {
        if (null === expiration) {
            this.expiry = this.defaultLifetime > 0 ? ((Date.now() / 1000) + this.defaultLifetime) : null;
        }
        else if (expiration instanceof Date) {
            this.expiry = (expiration.getTime() / 1000);
        }
        else {
            throw new Error(`Expiration date must be instance of Date or be null, "${(expiration.name)}" given`)
        }

        return this;
    };

    expiresAfter = (time) => {
        if (null === time) {
            this.expiry = this.defaultLifetime > 0 ? ((Date.now() / 1000) + this.defaultLifetime) : null;
        }
        else if (Number.isInteger(time)) {
            this.expiry = ((new Date).getTime() / 1000) + time;
        }
        else {
            throw new Error(`Expiration date must be an integer or be null, "${(time.name)}" given`)
        }

        return this;
    };

    tag = (tags) => {
        if (!this.isTaggable) {
            throw new Error(`Cache item "${this.key}" comes from a non tag-aware pool: you cannot tag it.`);
        }
        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        for (let tag of tags) {
            if (typeof tag !== "string") {
                throw new Error(`Cache tag must by a string, "${(typeof tag)}" given.`);
            }
            if (this.newMetadata.tags[tag]) {
                if (tag === '') {
                    throw new Error("Cache tag length must be greater than zero");
                }
            }
            this.newMetadata.tags[tag] = tag;
        }

        return this;
    };

    getMetadata = () => {
        return this.metadata;
    };

    static validateKey = (key) => {
        if (typeof key !== "string") {
            throw new Error(`Cache key must be string, "${(typeof key)}" given.`);
        }
        if ('' === key) {
            throw new Error("Cache key length must be greater than zero");
        }
        for (let reserved of CacheItem.RESERVED_CHARACTERS) {
            if (key.indexOf(reserved) >= 0) {
                throw new Error(`Cache key "${key}" contains reserved character "${reserved}".`);
            }
        }

        return key;
    };
}