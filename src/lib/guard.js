/**
 * Property names that only exist on the prototype chain and give access to constructors,
 * prototypes or accessor-definition helpers. Expressions are not allowed to reach them,
 * otherwise `foo.constructor` & co. expose the host's global machinery.
 *
 * A legitimate *own* property with one of these names (e.g. a data object with a
 * "constructor" key) is still readable.
 */
const FORBIDDEN_INHERITED = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
];

/**
 * @param {Object} target The object being accessed
 * @param {string|number} name The property / method / index being read
 * @throws {Error} when the access would go through a forbidden inherited member
 */
export function assertAccessible(target, name) {
    const key = String(name);
    if (FORBIDDEN_INHERITED.indexOf(key) !== -1 && !Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error(`Access to "${key}" is not allowed.`);
    }
}
