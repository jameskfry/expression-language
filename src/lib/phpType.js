const isPlainObject = (value) => {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * Name of the type of a value the way PHP words it in its error messages: "int", "float", "string", "bool", "null", "array" and "object".
 *
 * As in PHP, an array and a hash are both an "array"; an instance of a class (or a function) is an "object".
 *
 * @param {*} value
 * @returns {'null'|'bool'|'int'|'float'|'string'|'array'|'object'}
 */
export function phpTypeName(value) {
    if (null === value || undefined === value) {
        return 'null';
    }

    switch (typeof value) {
        case 'boolean': return 'bool';
        case 'number': return Number.isInteger(value) ? 'int' : 'float';
        case 'string': return 'string';
        case 'object': return Array.isArray(value) || isPlainObject(value) ? 'array' : 'object';
    }

    return 'object';
}
