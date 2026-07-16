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
import {arrayIntersectFn} from "./Provider/ArrayProvider";

/**
 * Helpers referenced by javascript source produced by ExpressionLanguage#compile()
 * for the bundled StringProvider/ArrayProvider/DateProvider functions (e.g.
 * `strtolower`, `count`, `date`). Those functions wrap PHP-compatible
 * (locutus) implementations that don't exist as JavaScript globals, so
 * compiled output calls them as `__runtime.<name>(...)`.
 *
 * To execute compile() output that uses one of those functions, pass this
 * object into scope under the name `__runtime`, e.g.:
 *
 *   const fn = new Function('__runtime', ...names, el.compile(expr, names));
 *   fn(compileRuntime, ...values);
 *
 * Expressions that only use core syntax (arithmetic, comparisons, in/not in,
 * .., custom self-contained functions registered via register()/addFunction())
 * don't need this — it's only required when a provider function appears in
 * the expression being compiled.
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
    strtotime
};

export default compileRuntime;
