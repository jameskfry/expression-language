import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";
import array_intersect from "locutus/php/array/array_intersect";
import count from "locutus/php/array/count";
import implode from "locutus/php/strings/implode";

export default class ArrayProvider extends AbstractProvider {
    getFunctions() {
        return [
            implodeFn,
            countFn,
            arrayIntersectFn
        ];
    }
}

export const implodeFn = new ExpressionFunction(
    'implode',
    function compiler(glue, pieces) {
        //console.log("compile implode: ", pieces, glue, typeof pieces);
        return `implode(${glue}, ${pieces})`;
    },
    function evaluator(values, glue, pieces) {
        return implode(glue, pieces);
    }
);

export const countFn = new ExpressionFunction(
    'count',
    function compiler(mixedVar, mode) {
        let remaining = '';
        if (mode) {
            remaining = `, ${mode}`;
        }
        return `count(${mixedVar}${remaining})`;
    },
    function evaluator(values, mixedVar, mode) {
        return count(mixedVar, mode);
    }
);

export const arrayIntersectFn = new ExpressionFunction(
    'array_intersect',
    function compiler(arr1, ...rest) {
        let remaining = '';
        if (rest.length > 0) {
            remaining = ", " + rest.join(", ");
        }
        return `array_intersect(${arr1}${remaining})`;
    },
    function evaluator(values) {
        let newArgs = [],
            allArrays = true;
        for (let i = 1; i < arguments.length; i++) {
            newArgs.push(arguments[i]);
            if (!Array.isArray(arguments[i])) {
                allArrays = false;
            }
        }
        let res = array_intersect.apply(null, newArgs);

        if (allArrays) {
            return Object.values(res);
        }
        return res;
    }
);
