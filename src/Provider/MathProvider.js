import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";
import {round} from "locutus/php/math/round";
import {rand} from "locutus/php/math/rand";

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
    (x) => `__runtime.abs(${x})`,
    (values, x) => Math.abs(x)
).withPhpFunction('abs');

export const roundFn = new ExpressionFunction(
    'round',
    (x, precision) => precision !== undefined
        ? `__runtime.round(${x}, ${precision})`
        : `__runtime.round(${x})`,
    (values, x, precision = 0) => round(x, precision)
).withPhpFunction('round');

export const floorFn = new ExpressionFunction(
    'floor',
    (x) => `__runtime.floor(${x})`,
    (values, x) => Math.floor(x)
).withPhpFunction('floor');

export const ceilFn = new ExpressionFunction(
    'ceil',
    (x) => `__runtime.ceil(${x})`,
    (values, x) => Math.ceil(x)
).withPhpFunction('ceil');

export const powFn = new ExpressionFunction(
    'pow',
    (base, exp) => `__runtime.pow(${base}, ${exp})`,
    (values, base, exp) => Math.pow(base, exp)
).withPhpFunction('pow');

export const sqrtFn = new ExpressionFunction(
    'sqrt',
    (x) => `__runtime.sqrt(${x})`,
    (values, x) => Math.sqrt(x)
).withPhpFunction('sqrt');

export const clampFn = new ExpressionFunction(
    'clamp',
    (val, min, max) => `__runtime.clamp(${val}, ${min}, ${max})`,
    (values, val, min, max) => Math.min(max, Math.max(min, val)),
    (val, min, max) => `\\min(${max}, \\max(${min}, ${val}))`
);

export const randFn = new ExpressionFunction(
    'rand',
    (...args) => `__runtime.rand(${args.join(', ')})`,
    (values, ...args) => rand(...args)
).withPhpFunction('rand');

export const randomFn = new ExpressionFunction(
    'random',
    () => '__runtime.random()',
    () => Math.random(),
    () => '(\\lcg_value())'
);
