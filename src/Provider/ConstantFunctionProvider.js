import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";
import LogicException from "../LogicException";

/**
 * Resolves a dotted constant path (e.g. "Math.PI", "Roles.ADMIN") below `root` and returns its value.
 *
 * IMPORTANT: this function is also embedded verbatim, via Function#toString(), into the output of
 * ExpressionLanguage#compile(). It therefore has to stay self-contained and written in plain ES5.
 *
 * Only own properties are followed, so inherited members ("constructor", "__proto__", ...) can never be reached.
 */
/* istanbul ignore next: serialised with Function#toString(), so it must not hold the counters of a coverage run */
function resolveAllowedConstant(root, name, regexpSource, label) {
    if (typeof name !== 'string') {
        throw new Error(label + ' name must be a string.');
    }

    // PHP style separators are accepted too: "App\\Enum\\Status::Active" -> "App.Enum.Status.Active"
    var normalized = name.replace(/\\/g, '.').replace(/::/g, '.').replace(/^\./, '');
    if (!new RegExp(regexpSource).test(normalized)) {
        throw new Error(label + ' "' + name + '" is not allowed.');
    }

    var parts = normalized.split('.');
    var value = root;
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] === ''
            || value === null
            || (typeof value !== 'object' && typeof value !== 'function')
            || !Object.prototype.hasOwnProperty.call(value, parts[i])) {
            throw new Error(label + ' "' + name + '" is not defined.');
        }
        value = value[parts[i]];
    }

    return value;
}

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getGlobal = () => (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));

const GLOBAL_SOURCE = "(typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:(typeof global!=='undefined'?global:{})))";

/**
 * Provides the constant() and enum() functions, restricted to a list of allowed constants.
 *
 * Each entry is a constant path such as "Math.PI" or "Roles.ADMIN" in which "*" matches any sequence of characters
 * within one path segment (it never crosses a ".", nor a PHP style "\" or "::" separator). For example,
 * "Roles.ROLE_*" allows the members of `Roles` whose name starts with "ROLE_", and "Status.*" allows every member of `Status`.
 * Names are matched case-sensitively and only own properties are ever followed.
 *
 * Constants are looked up on the global object by default; pass `root` to look them up on any other object
 * (such a provider can evaluate expressions, but cannot be used with compile(), whose output can only see globals).
 */
export default class ConstantFunctionProvider extends AbstractProvider {
    /**
     * @param {string[]} allowedConstants
     * @param {Object|null} root The object the constants are resolved against (default: the global object)
     */
    constructor(allowedConstants, root = null) {
        super();
        if (!Array.isArray(allowedConstants)) {
            throw new TypeError('The allowed constants must be provided as an array of strings.');
        }

        const patterns = allowedConstants.map((constant) => {
            const normalized = String(constant).replace(/\\/g, '.').replace(/::/g, '.').replace(/^\./, '');
            const pattern = normalized.split('*').map(escapeRegExp).join('[^.]*');

            // a trailing "*" must match at least one character
            return pattern.endsWith('[^.]*') ? pattern.slice(0, -'[^.]*'.length) + '[^.]+' : pattern;
        });

        this.regexpSource = patterns.length > 0 ? '^(?:' + patterns.join('|') + ')$' : '(?!)';
        this.root = root;
    }

    getFunctions() {
        return [
            this._createFunction('constant', 'Constant'),
            this._createFunction('enum', 'Enum case'),
        ];
    }

    _createFunction(name, label) {
        return new ExpressionFunction(
            name,
            (constantName) => {
                if (null !== this.root) {
                    throw new LogicException(`${name}() was registered with a custom root, so it cannot be compiled: compiled code can only resolve constants on the global object.`);
                }

                return `(${resolveAllowedConstant.toString()})(${GLOBAL_SOURCE}, ${constantName}, ${JSON.stringify(this.regexpSource)}, ${JSON.stringify(label)})`;
            },
            (values, constantName) => resolveAllowedConstant(this.root ?? getGlobal(), constantName, this.regexpSource, label)
        );
    }
}
