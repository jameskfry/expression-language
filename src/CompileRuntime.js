import {explode} from "locutus/php/strings/explode";
import {strlen} from "locutus/php/strings/strlen";
import {strtolower} from "locutus/php/strings/strtolower";
import {strtoupper} from "locutus/php/strings/strtoupper";
import {substr} from "locutus/php/strings/substr";
import {strstr} from "locutus/php/strings/strstr";
import {stristr} from "locutus/php/strings/stristr";
import {implode} from "locutus/php/strings/implode";
import {count} from "locutus/php/array/count";
import {date} from "locutus/php/datetime/date";
import {strtotime} from "locutus/php/datetime/strtotime";
import {round} from "locutus/php/math/round";
import {rand} from "locutus/php/math/rand";
import {arrayIntersectFn} from "./Provider/ArrayProvider";
import {SEMANTICS} from "./Semantics";

/**
 * Helpers referenced by javascript source produced by ExpressionLanguage#compile()
 * for the bundled StringProvider/ArrayProvider/DateProvider/MathProvider functions
 * (e.g. `strtolower`, `count`, `date`, `round`, `clamp`). Those functions wrap
 * PHP-compatible implementations that don't exist as JavaScript globals, so
 * compiled output calls them as `__runtime.<name>(...)`.
 *
 * To execute compile() output that uses one of those functions, pass this
 * object into scope under the name `__runtime`, e.g.:
 *
 *   const fn = new Function('__runtime', ...names, el.compile(expr, names));
 *   fn(compileRuntime, ...values);
 *
 * The operators (`+`, `==`, `&&`, `in`, ...) of the "symfony" and "portable"
 * semantics, the default, are calls to `__runtime.symfony` / `__runtime.portable`
 * too. Only the "js" semantics compiles to code that needs nothing: core syntax
 * (arithmetic, comparisons, in/not in, .., custom self-contained functions
 * registered via register()/addFunction()) is then fully self-contained.
 */
const compileRuntime = {
    strtolower,
    strtoupper,
    explode,
    strlen,
    strstr,
    stristr,
    substr,
    implode,
    count,
    array_intersect: (...args) => arrayIntersectFn.getEvaluator()(null, ...args),
    date,
    strtotime,
    abs: Math.abs,
    round,
    floor: Math.floor,
    ceil: Math.ceil,
    pow: Math.pow,
    sqrt: Math.sqrt,
    clamp: (val, min, max) => Math.min(max, Math.max(min, val)),
    rand,
    random: Math.random,
    // the operators of the "symfony" and "portable" semantics (the default ones), which compile() calls
    symfony: SEMANTICS.symfony,
    portable: SEMANTICS.portable,
    js: SEMANTICS.js
};

export default compileRuntime;
