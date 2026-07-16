import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";

export default class BasicProvider extends AbstractProvider {
    getFunctions() {
        return [
            issetFn
        ];
    }
}

export const issetFn = new ExpressionFunction(
    'isset',
    function compiler(variable) {
        // evaluate() also accepts a string-literal PHP-style path, e.g.
        // isset("foo['bar']"), and parses it at runtime against `values`.
        // compile() has no `values` object to parse against, and naively
        // wrapping the literal in a try/catch would just check that the
        // string constant itself is non-null (always true) — a silent wrong
        // answer. Fail loudly instead of guessing.
        if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(variable)) {
            throw new Error('isset() does not support compile() when called with a string-literal path (e.g. isset("foo.bar")). Use an expression path instead (e.g. isset(foo.bar) or isset(foo?.bar)), or call evaluate() directly.');
        }

        // Self-contained: wraps the compiled argument expression (e.g. a
        // property/array access chain that may throw on a missing base) in a
        // try/catch so a non-existent path compiles to `false` instead of
        // depending on an undefined global `isset()` helper or throwing.
        return `(function(){try{var __v=(${variable});return __v!==null&&__v!==undefined;}catch(e){return false;}})()`;
    },
    function evaluator(values, variable) {
        // If the argument was already resolved (not a string path),
        // check whether the resolved value is set (not null/undefined).
        if (typeof variable !== 'string') {
            return variable !== null && variable !== undefined;
        }

        // For string arguments, determine if it's a variable path (e.g. "foo.bar")
        // or an already-resolved string value (e.g. foo.bar resolved to "hello").
        // If the base name references a known variable, treat it as a path to resolve.
        let basePart = variable.split(/[.\[]/)[0];
        if (!(basePart in values)) {
            // Not a known variable path — this is a resolved string value.
            return true;
        }

        let baseName = "",
            parts = [],
            gathering = "",
            gathered = "";

        for (let i = 0; i < variable.length; i++) {
            let char = variable[i];
            if (char === "]") {
                gathering = "";
                parts.push({type: 'array', index: gathered.replace(/"/g, "").replace(/'/g, "")});
                gathered = "";
                continue;
            }
            if (char === "[") {
                gathering = "array";
                gathered = "";
                continue;
            }
            if (gathering === "object" && (!/[A-z0-9_]/.test(char) || i === variable.length - 1)) {
                let lastChar = false;
                if (i === variable.length - 1) {
                    gathered += char;
                    lastChar = true;
                }
                gathering = "";
                parts.push({type: 'object', attribute: gathered});
                gathered = "";

                if (lastChar) {
                    continue;
                }
            }
            if (char === ".") {
                gathering = "object";
                gathered = "";
                continue;
            }
            if (gathering) {
                gathered += char;
            } else {
                baseName += char;
            }
        }

        if (parts.length > 0) {
            if (values[baseName] !== undefined) {
                let baseVar = values[baseName];
                for (let part of parts) {
                    if (part.type === "array") {
                        if (baseVar[part.index] === undefined) {
                            return false;
                        }
                        baseVar = baseVar[part.index];
                    }
                    if (part.type === "object") {
                        if (baseVar[part.attribute] === undefined) {
                            return false;
                        }
                        baseVar = baseVar[part.attribute];
                    }
                }

                return true;
            }

            return false;
        } else {
            return values[baseName] !== undefined;
        }
    }
);
