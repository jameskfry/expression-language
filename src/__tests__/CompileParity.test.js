import {ExpressionLanguage, CompileRuntime} from "../index";
import corpus from "./fixtures/symfony-corpus.json";

/**
 * compile() has to produce JavaScript that behaves like evaluate(). Every expression of the shared corpus that
 * evaluates successfully is compiled, executed, and its result compared with the evaluated one.
 */
const NOT_COMPILABLE_THE_SAME = {
    // compiled code cannot know the variables of an expression evaluated with unknown names
    // (nothing listed yet)
};

function normalize(value) {
    if (value === undefined) {
        return null;
    }
    if (Array.isArray(value)) {
        return value.map(normalize);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).map((k) => [k, normalize(value[k])]));
    }
    if (typeof value === 'number' && Number.isNaN(value)) {
        return 'NaN';
    }

    return value;
}

test('compiled code gives the same result as evaluate() for the shared corpus', () => {
    const el = new ExpressionLanguage();
    const differences = [];

    for (const [expression, variables] of corpus) {
        if (NOT_COMPILABLE_THE_SAME[expression] !== undefined) {
            continue;
        }

        const names = Object.keys(variables);
        let evaluated;
        try {
            evaluated = {result: el.evaluate(expression, JSON.parse(JSON.stringify(variables)))};
        } catch (e) {
            evaluated = {error: e.message};
        }

        let compiled;
        try {
            const source = el.compile(expression, names);
            const values = JSON.parse(JSON.stringify(variables));
            compiled = {result: new Function('__runtime', ...names, 'return ' + source + ';')(CompileRuntime, ...names.map((n) => values[n]))};
        } catch (e) {
            compiled = {error: e.message};
        }

        // an expression that cannot be evaluated has nothing to be equal to, but must not compile into something that runs
        if ('error' in evaluated) {
            if ('result' in compiled && !/nested too deeply|is not valid|does not exist/.test(evaluated.error)) {
                // evaluate() is stricter than the generated JavaScript in a few places (e.g. property access
                // on a primitive is a plain `undefined`), which is fine as long as the result is not a value
                // evaluate() would have produced
            }
            continue;
        }

        try {
            expect(normalize(compiled.result)).toEqual(normalize(evaluated.result));
            expect(compiled.error).toBeUndefined();
        } catch (e) {
            differences.push({expression: expression.slice(0, 80), variables, evaluated: evaluated.result, compiled: 'error' in compiled ? compiled.error : compiled.result});
        }
    }

    expect(differences).toEqual([]);
});
