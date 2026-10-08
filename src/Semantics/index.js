import * as symfony from "./php";
import * as js from "./js";
import * as portable from "./portable";

export const SEMANTICS = {symfony, js, portable};

export const SEMANTICS_NAMES = Object.keys(SEMANTICS);

/**
 * @param {string|undefined} name "symfony" (the default when nothing is said), "js" or "portable"
 */
export function getSemantics(name = 'symfony') {
    const semantics = SEMANTICS[name];
    if (undefined === semantics) {
        throw new RangeError(`Unknown semantics "${name}": use ${SEMANTICS_NAMES.map((n) => `"${n}"`).join(', ')}.`);
    }

    return semantics;
}
