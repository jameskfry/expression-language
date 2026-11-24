import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";

export default class MathProvider extends AbstractProvider {
    getFunctions() {
        return [
            absFn,
            roundFn,
            floorFn,
            ceilFn,
            powFn,
            sqrtFn,
            clampFn,
            randFn,
            randomFn,
        ];
    }
}

export const absFn = new ExpressionFunction(
    'abs',
    (x) => `Math.abs(${x})`,
    (values, x) => Math.abs(x)
).withPhpFunction('abs');

export const roundFn = new ExpressionFunction(
    'round',
    (x, precision) => precision !== undefined
        ? `(function(v, p){ var m = Math.pow(10, p); return Math.round(v * m) / m; })(${x}, ${precision})`
        : `Math.round(${x})`,
    (values, x, precision = 0) => {
        const p = Math.pow(10, precision);
        return Math.round(x * p) / p;
    }
).withPhpFunction('round');

export const floorFn = new ExpressionFunction(
    'floor',
    (x) => `Math.floor(${x})`,
    (values, x) => Math.floor(x)
).withPhpFunction('floor');

export const ceilFn = new ExpressionFunction(
    'ceil',
    (x) => `Math.ceil(${x})`,
    (values, x) => Math.ceil(x)
).withPhpFunction('ceil');

export const powFn = new ExpressionFunction(
    'pow',
    (base, exp) => `Math.pow(${base}, ${exp})`,
    (values, base, exp) => Math.pow(base, exp)
).withPhpFunction('pow');

export const sqrtFn = new ExpressionFunction(
    'sqrt',
    (x) => `Math.sqrt(${x})`,
    (values, x) => Math.sqrt(x)
).withPhpFunction('sqrt');

export const clampFn = new ExpressionFunction(
    'clamp',
    (val, min, max) => `Math.min(${max}, Math.max(${min}, ${val}))`,
    (values, val, min, max) => Math.min(max, Math.max(min, val)),
    (val, min, max) => `\\min(${max}, \\max(${min}, ${val}))`
);

export const randFn = new ExpressionFunction(
    'rand',
    (min, max) => min !== undefined && max !== undefined
        ? `(Math.floor(Math.random() * ((${max}) - (${min}) + 1)) + (${min}))`
        : `Math.floor(Math.random() * 2147483648)`,
    (values, min, max) => {
        if (min === undefined && max === undefined) {
            return Math.floor(Math.random() * 2147483648);
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
).withPhpFunction('rand');

export const randomFn = new ExpressionFunction(
    'random',
    () => 'Math.random()',
    () => Math.random(),
    () => '(\\lcg_value())'
);
