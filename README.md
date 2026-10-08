# Javascript implementation of the Symfony/ExpressionLanguage

The idea is to be able to evaluate the same expressions client-side (in Javascript with this library)
and server-side (in PHP with the Symfony/ExpressionLanguage).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Feature parity

Below is the current parity of this library with Symfony's ExpressionLanguage features. All items default to supported
status.

| Category                | Feature                                                                      | Supported |
|-------------------------|------------------------------------------------------------------------------|-----------|
| Literals                | Strings (single and double quotes)                                           | ✅         |
| Literals                | Numbers (integers, decimals, decimals without leading zero) with underscores | ✅         |
| Literals                | Arrays (JSON-like [ ... ])                                                   | ✅         |
| Literals                | Hashes/Objects (JSON-like { key: value })                                    | ✅         |
| Literals                | Booleans (true/false)                                                        | ✅         |
| Literals                | null                                                                         | ✅         |
| Literals                | Exponential/scientific notation                                              | ✅         |
| Literals                | Block comments /* ... */ inside expressions                                  | ✅         |
| Escapes                 | String escapes follow PHP's `stripcslashes()` (`\n`, `\t`, `\x41`, `\101`, `\\`, `\"`) | ✅         |
| Objects                 | Access public properties with dot syntax (obj.prop)                          | ✅         |
| Objects                 | Call methods with dot syntax (obj.method(...))                               | ✅         |
| Objects                 | Null-safe operator (obj?.prop / obj?.method())                               | ✅         |
| Arrays                  | Null-safe array access (arr?.[0])                                            | ✅         |
| Nullish                 | Null-coalescing operator (a ?? b)                                            | ✅         |
| Functions               | constant(), enum() — restricted to an allow list (`ConstantFunctionProvider`) | ✅         |
| Functions               | min(), max() — several values or a single array                             | ✅         |
| Functions               | count()                                                                      | ✅         |
| Arrays                  | Access array items with bracket syntax (arr[...])                            | ✅         |
| Operators: Arithmetic   | +, -, *, /, %, **                                                            | ✅         |
| Operators: Bitwise      | &, \| , ^                                                                    | ✅         |
| Operators: Bitwise      | ~ (not), <<, >>                                                              | ✅         |
| Operators: Comparison   | ==, ===, !=, !==, <, >, <=, >=                                               | ✅         |
| Operators: Comparison   | matches (regex)                                                              | ✅         |
| Operators: String tests | contains, starts with, ends with (case-sensitive; opt-in case-insensitive)   | ✅         |
| Operators: Logical      | not/!, and/&&, or/\|\|, xor (always yield booleans)                          | ✅         |
| Operators: String       | ~ (concatenation)                                                            | ✅         |
| Operators: Array        | in, not in (strict comparison)                                               | ✅         |
| Operators: Numeric      | .. (range)                                                                   | ✅         |
| Operators: Ternary      | a ? b : c, a ?: b, a ? b (the else branch is `null`)                        | ✅         |
| Other                   | Null-safe operator (?.)                                                      | ✅         |
| Other                   | Null-coalescing operator (??)                                                | ✅         |
| Precedence              | Operator precedence as per Symfony docs                                      | ✅         |
| fromPhp()               | Supported as fromJavascript()                                                | ✅         |
| Compilation             | `CompiledExpressionLanguage` — dumps JavaScript or PHP                       | ✅         |
| Symfony Built-ins       | Security expression variables                                                | ⛔️        |
| Symfony Built-ins       | Service container expression variables                                       | ⛔️        |
| Symfony Built-ins       | Routing expression variables                                                 | ⛔️        |

> Notes: Symfony Built-ins are not supported in the javascript environment

The behaviour listed above is checked against Symfony itself: [a corpus of 400+ expressions](src/__tests__/fixtures/symfony-corpus.json)
is evaluated by Symfony's own PHP code and the results (and error messages) are compared with this library's in
[SymfonyParity.test.js](src/__tests__/SymfonyParity.test.js). See [Known differences](#known-differences-from-symfony) for what
cannot be identical, [Semantics](#semantics-symfonys-rules-javascripts-or-both) to choose which rules operators follow, and
[UPGRADE-3.0.md](UPGRADE-3.0.md) if you are coming from 2.x.

## Installation

### NPM/Yarn

```bash
npm install expression-language
# or
yarn add expression-language
```

### Browser

You can also use this library directly in the browser by including it via a script tag:

```html
<!-- Unminified version for development -->
<script src="https://unpkg.com/expression-language/dist/expression-language.js"></script>
<!-- or minified version for production -->
<script src="https://unpkg.com/expression-language/dist/expression-language.min.js"></script>
```

## Examples

### NPM/Yarn Setup

```javascript
import {ExpressionLanguage} from "expression-language";

let expressionLanguage = new ExpressionLanguage();
```

### Browser Setup

```html

<script src="https://unpkg.com/expression-language/dist/expression-language.min.js"></script>
<script>
    // The library is available as a global ExpressionLanguage object
    const expressionLanguage = new ExpressionLanguage.ExpressionLanguage();
</script>
```

A complete browser example is available in the [examples/browser-usage.html](examples/browser-usage.html) file.

#### Basic

```javascript
let result = expressionLanguage.evaluate('1 + 1');
// result is 2.
```

#### Multiple clauses

```javascript
let result = expressionLanguage.evaluate(
    'a > 0 && b != a',
    {
        a: 1,
        b: 2
    }
);
// result is true
```

#### Object and Array access
```javascript
let expression = 'a[2] === "three" and b.myMethod(a[1]) === "bar two"';
let values = {
    a: ["one", "two", "three"],
    b: {
        myProperty: "foo",
        myMethod: function (word) {
            return "bar " + word;
        }
    }
};
let result = expressionLanguage.evaluate(expression, values);
// result is true
```

#### Registering custom functions
You can register functions in two main ways. Make sure to register functions before calling evaluate(), compile(), or parse(); otherwise a LogicException will be thrown.

- Using register(name, compiler, evaluator):
```javascript
import { ExpressionLanguage } from 'expression-language';

const el = new ExpressionLanguage();

// Define how the function should compile to JavaScript and how it should evaluate at runtime.
el.register(
  'double',
  // compiler: receives the compiled argument strings and must return JS source
  (x) => `((+${x}) * 2)`,
  // evaluator: receives (values, ...args) and returns the result
  (values, x) => Number(x) * 2
);

console.log(el.evaluate('double(21)')); // 42
console.log(el.compile('double(a)', ['a'])); // '((+a) * 2)'
```

- Using addFunction with an ExpressionFunction instance:
```javascript
import { ExpressionLanguage, ExpressionFunction } from 'expression-language';

const el = new ExpressionLanguage();
const timesFn = new ExpressionFunction(
  'times',
  (a, b) => `(${a} * ${b})`,
  (values, a, b) => a * b
);

el.addFunction(timesFn);

console.log(el.evaluate('times(6, 7)')); // 42
```

#### Using providers
Providers are a convenient way to bundle and register multiple functions. A provider exposes a getFunctions() method that returns an array of ExpressionFunction instances. You can register providers via the constructor or with registerProvider().

- Built-in providers you can use out of the box:
  - BasicProvider: isset()
  - StringProvider: strtolower, strtoupper, explode, strlen, strstr, stristr, substr
  - ArrayProvider: implode, count, array_intersect
  - DateProvider: date, strtotime

- Registering built-in providers:
```javascript
import { ExpressionLanguage, StringProvider, ArrayProvider, DateProvider, BasicProvider } from 'expression-language';

// Pass providers in the constructor (array or any iterable)
const el = new ExpressionLanguage(null, [
  new StringProvider(),
  new ArrayProvider(),
  new DateProvider(),
  new BasicProvider(),
]);

console.log(el.evaluate('strtoupper("hello")')); // 'HELLO'
console.log(el.evaluate('count([1,2,3])')); // 3
console.log(el.evaluate('isset(foo.bar)', { foo: { bar: 1 } })); // true
```

##### Running compiled output that uses provider functions
`compile()` (unlike `evaluate()`) returns a *string* of JavaScript source — it's up to you to run it, typically with `new Function()`. Operators are not plain JavaScript operators: `a + b` means what it means in Symfony, so with the default [semantics](#semantics-symfonys-rules-javascripts-or-both) it compiles to `__runtime.symfony.add(a, b)`. The bundled provider functions (`strtolower`, `count`, `date`, etc.) wrap PHP-compatible implementations that don't exist as JavaScript globals either, so their compiled output calls `__runtime.<name>(...)`. Pass `CompileRuntime` into scope under the name `__runtime` when executing the code. (With `semantics: 'js'`, core syntax such as arithmetic, comparisons, `in`/`not in`, `..` and the custom functions you register compiles to fully self-contained JavaScript: only provider functions need the runtime.)

```javascript
import { ExpressionLanguage, StringProvider, CompileRuntime } from 'expression-language';

const el = new ExpressionLanguage(null, [new StringProvider()]);
const source = el.compile('strtoupper(a)', ['a']); // '__runtime.strtoupper(a)'

const fn = new Function('__runtime', 'a', `return ${source};`);
console.log(fn(CompileRuntime, 'hello')); // 'HELLO'
```

Note: `isset()` only supports `compile()` with an expression path (`isset(foo.bar)`, `isset(foo?.bar)`) — the string-literal calling style that `evaluate()` also accepts (`isset("foo['bar']")`) has no `values` object to resolve against at compile time, so `compile()` throws for that form rather than silently returning a wrong answer.

- Creating your own provider:
```javascript
import { ExpressionLanguage, ExpressionFunction } from 'expression-language';

class MathProvider {
  getFunctions() {
    return [
      new ExpressionFunction(
        'clamp',
        (x, min, max) => `Math.min(${max}, Math.max(${min}, ${x}))`,
        (values, x, min, max) => Math.min(max, Math.max(min, x))
      ),
      new ExpressionFunction(
        'pct',
        (value, total) => `(((${value}) / (${total})) * 100)`,
        (values, value, total) => (value / total) * 100
      )
    ];
  }
}

const el = new ExpressionLanguage();
el.registerProvider(new MathProvider());

console.log(el.evaluate('clamp(150, 0, 100)')); // 100
console.log(el.evaluate('pct(2, 8)')); // 25
```

#### Using ExpressionFunction.fromJavascript()
Use this helper to wrap an existing JavaScript function (resolved from the global object) as an ExpressionFunction.

Rules and tips:
- If you pass a namespaced/dotted path like 'Math.max', you must also provide an explicit expression function name (e.g., 'max').
- For non-namespaced global functions (e.g., 'myFn'), the expression function name defaults to the same name.
- The function must exist on globalThis (window in browsers, global in Node). If it does not exist, an error is thrown.

Examples:
```javascript
import { ExpressionLanguage, ExpressionFunction } from 'expression-language';

const el = new ExpressionLanguage();

// 1) Non-namespaced global function
globalThis.mySum = (a, b) => a + b; // or window.mySum in browser
const sumFn = ExpressionFunction.fromJavascript('mySum');
el.addFunction(sumFn);
// 2) Namespaced (dotted) function requires an explicit expression name
const maxFn = ExpressionFunction.fromJavascript('Math.max', 'max');
el.addFunction(maxFn);

console.log(el.evaluate('mySum(20, 22)')); // 42
console.log(el.evaluate('max(1, 3, 2)')); // 3

// Note: min/max/count are already built-in.
```

> Note: Register functions or providers before calling evaluate(), compile(), or parse(); late registration will throw a LogicException.

#### Constants and enums
`constant()` and `enum()` are **not** available out of the box: letting an expression read arbitrary globals would
expose things like `process.env` to whoever writes the expression. Register a `ConstantFunctionProvider` with the
list of constants expressions are allowed to read, exactly like Symfony 8.2's provider of the same name.

```javascript
import { ExpressionLanguage, ConstantFunctionProvider } from 'expression-language';

const el = new ExpressionLanguage(null, [
  new ConstantFunctionProvider([
    'Math.PI',        // one constant
    'App.Roles.*',    // "*" matches within one path segment: App.Roles.ADMIN, App.Roles.USER, ...
  ]),
]);

el.evaluate('constant("Math.PI")');            // 3.14159...
el.evaluate('enum("App.Roles.ADMIN")');        // 'ROLE_ADMIN'
el.evaluate('enum("App\\\\Roles::ADMIN")');    // PHP style names work too (backslashes are doubled in string literals)
el.evaluate('constant("process.env.HOME")');   // throws: Constant "process.env.HOME" is not allowed.
```

- Names are case-sensitive and only own properties are followed, so `constructor` or `__proto__` can never be reached.
- Constants are looked up on the global object. Pass a second argument to look them up on any other object
  (`new ConstantFunctionProvider(['Colors.*'], { Colors })`); such a provider can evaluate but not `compile()`.
- With an empty list, nothing can be read.

#### String operators and case sensitivity
`contains`, `starts with` and `ends with` are **case-sensitive**, like Symfony's (and like JavaScript's own
`includes()` / `startsWith()` / `endsWith()`). `null` counts as an empty string.

```javascript
el.evaluate('"Hello" contains "hello"'); // false
```

To ignore case, either set the option once for the whole instance:

```javascript
const el = new ExpressionLanguage(null, [], { caseInsensitiveStringOperators: true });
el.evaluate('"Hello" contains "hello"'); // true
```

or pass the `CASE_INSENSITIVE_STRING_OPERATORS` flag to a single `parse()` / `lint()` (it can be combined with the
`IGNORE_*` flags using `|`). Only these three operators are affected; `==`, `in` and `matches` keep their meaning.

```javascript
import { ExpressionLanguage, CASE_INSENSITIVE_STRING_OPERATORS } from 'expression-language';

const parsed = el.parse('name contains "bob"', ['name'], CASE_INSENSITIVE_STRING_OPERATORS);
el.evaluate(parsed, { name: 'Bob' }); // true
```

#### Strings and regular expressions
String literals are decoded like Symfony does (PHP's `stripcslashes()`): `"a\nb"` contains a real newline,
`"\x41"` is `A`, and a backslash in front of any other character is dropped. The consequence is the same as in
Symfony: **a backslash that must reach a regex has to be doubled**.

```javascript
el.evaluate('"5" matches "/^\\\\d$/"');  // the expression text is  "5" matches "/^\\d$/"   -> true
el.evaluate('"5" matches "/^\\d$/"');    // the expression text is  "5" matches "/^\d$/"    -> the pattern is /^d$/ -> false
```

`matches` takes a PCRE style pattern: any non-alphanumeric delimiter (`/re/`, `#re#`, `{re}`) followed by the modifiers
`i`, `m`, `s` and `u`. An invalid pattern raises a `SyntaxError`.

#### Security notes
Expressions are meant to be written by people you trust at least a little, but a few guard rails are on by default:

- No access to the host's globals: see [Constants and enums](#constants-and-enums).
- `evaluate()` refuses to read `constructor`, `prototype`, `__proto__`, `__defineGetter__` & co. through a property, a
  method call or an item (`foo.constructor`, `foo["__proto__"]`), unless the object really owns a property of that name.
- `compile()` returns plain JavaScript, which has none of these guards: never run the compiled output of an
  expression you do not trust.
- The functions and values you register or pass in are, of course, fully reachable from expressions.

#### Precompiling expressions (`CompiledExpressionLanguage`)
When the same expressions are evaluated again and again (rules, validations, pricing...), you can compile them once, at
build time, and ship the result. `CompiledExpressionLanguage` decorates an `ExpressionLanguage`: it evaluates the
expressions found in a compiled file by running the generated code, without lexing or parsing anything, and hands every
other expression to the language it decorates.

```javascript
import { ExpressionLanguage, CompiledExpressionLanguage } from 'expression-language';

// 1. at build time: dump the expressions you use
const expressions = ['price * quantity > 100', 'user?.age >= 18', 'name ?? "anonymous"'];
const source = new CompiledExpressionLanguage(new ExpressionLanguage()).dumpCompiled(expressions);
// write `source` to expressions.compiled.js

// 2. at runtime: load it and evaluate as usual
import compiled from './expressions.compiled.js';

const language = new CompiledExpressionLanguage(new ExpressionLanguage(), compiled);
language.evaluate('price * quantity > 100', { price: 10, quantity: 11 }); // true, from the compiled code
language.evaluate('price * 2', { price: 10 });                           // not in the file: evaluated the usual way
```

`dumpCompiled(expressions, options)` takes:

| Option | Values | |
|---|---|---|
| `target` | `'js'` (default), `'php'` | the language of the generated code |
| `format` | `'esm'` (default), `'cjs'`, `'expression'` | how a JavaScript dump is packaged: an ES module (`export default`), a CommonJS module (`module.exports`), or a bare object expression that `CompiledExpressionLanguage.load(source)` turns back into an object, for a dump you keep in a string or a database (it runs code: only load dumps you made) |

Things to know:

- The dump is made with the options of the language you decorate (for instance `caseInsensitiveStringOperators`). A
  JavaScript dump refuses to be loaded by a language with other options: dump it again.
- Expressions that cannot be compiled (a syntax error, an unknown function, an invalid `matches` pattern) are left out of the dump,
  and are simply handled by the decorated language.
- If a variable that the compiled code reads is missing from the values, the expression is handed to the decorated
  language, which reports it the usual way (`Variable "x" is not valid`). A variable only used behind a `??` may be missing.
- `lint()` uses the variables recorded in the dump instead of parsing.
- A function whose compiler throws is called through its evaluator (`functions[name].evaluator(values, ...args)`).
- The generated code is plain JavaScript. It is **more lenient than `evaluate()`**: the property of a number is `null`
  instead of an error, and the errors that do occur (a property of `null`) are JavaScript's own `TypeError`. The code is
  never run a second time to find a better message, so your functions and methods run exactly once. A result that would
  be `undefined` is `null`, and `compile()`'s caveats apply (no `constructor` / `__proto__` guard): dump expressions you
  wrote, never expressions typed by someone you do not trust.

##### Dumping PHP

`target: 'php'` generates the exact file that Symfony's own `CompiledExpressionLanguage` loads, so the expressions can be
compiled once in your JavaScript build and shipped to the PHP side as well:

```javascript
const php = new CompiledExpressionLanguage(language).dumpCompiled(expressions, { target: 'php' });
// write it to expressions.compiled.php, then, in PHP:
//   $language = new CompiledExpressionLanguage(new ExpressionLanguage(), __DIR__.'/expressions.compiled.php');
```

The generated PHP is what Symfony generates for the same expressions: for the 400+ expressions of this repository's corpus the
code is identical (Symfony only adds a few unused variables around `matches`), and Symfony's own loader evaluates the file like the
one it dumps itself (`scripts/verify-compiled-php.php`).

How a **function** is compiled to PHP is up to you, because your compilers produce JavaScript:

```javascript
import { ExpressionFunction } from 'expression-language';

// 1. nothing declared: the PHP code calls the evaluator registered under the same name on the PHP side
language.addFunction(new ExpressionFunction('discount', (p) => `(${p} * 0.9)`, (values, p) => p * 0.9));
//    -> $functions['discount']['evaluator']($values, $price)

// 2. it is a plain PHP function: the call is made directly
language.addFunction(new ExpressionFunction('strtoupper', (s) => `${s}.toUpperCase()`, (values, s) => s.toUpperCase()).withPhpFunction());
//    -> \strtoupper($name)       (withPhpFunction('app_upper') calls \app_upper instead)

// 3. or give the PHP compiler yourself, as the fourth argument
language.addFunction(new ExpressionFunction('clamp', jsCompiler, evaluator, (x, min, max) => `\\max(${min}, \\min(${max}, ${x}))`));
```

`min()`, `max()`, `count()` and the functions of `StringProvider`, `ArrayProvider` and `DateProvider` are already declared as PHP functions. `isset()` (`BasicProvider`) is not, so it is called through the evaluator.

A PHP file always runs with PHP's rules: the language it is dumped from has to use the `'symfony'` (the default) or `'portable'`
[semantics](#semantics-symfonys-rules-javascripts-or-both); a `'js'` one refuses to dump PHP. Beyond that, mind these:

- A number written as a float (`1.0`, `1e3`) is a PHP float, as in Symfony.
- A `matches` pattern is handed to `preg_match()` as written, and only `i`, `m`, `s` and `u` are accepted at dump time.
- With `caseInsensitiveStringOperators`, the PHP code uses `mb_strtolower()` and therefore needs `ext-mbstring`.
- Registered `ConstantFunctionProvider` constants are JavaScript paths, so `constant()` and `enum()` are called through the evaluators of the PHP side, which must exist there.

#### Using IGNORE_* flags
These flags let you relax strict validation when parsing expressions via the high-level API. They are useful for linting or building tools where variables/functions may be unknown at parse time.

- IGNORE_UNKNOWN_VARIABLES: allows names that are not provided in the names list.
- IGNORE_UNKNOWN_FUNCTIONS: allows calling functions that are not registered.
- You can combine flags with bitwise OR (|).

Examples:
```javascript
import { ExpressionLanguage, IGNORE_UNKNOWN_VARIABLES, IGNORE_UNKNOWN_FUNCTIONS } from 'expression-language';

const el = new ExpressionLanguage();

// 1) Allow unknown variables when parsing via ExpressionLanguage
el.parse('foo.bar', [], IGNORE_UNKNOWN_VARIABLES);

// 2) Allow unknown functions when parsing via ExpressionLanguage
el.parse('myFn()', [], IGNORE_UNKNOWN_FUNCTIONS);

// 3) Allow both unknown functions and variables
el.parse('myFn(foo)', [], IGNORE_UNKNOWN_FUNCTIONS | IGNORE_UNKNOWN_VARIABLES);
```

Linting:
```javascript
import { ExpressionLanguage, IGNORE_UNKNOWN_VARIABLES, IGNORE_UNKNOWN_FUNCTIONS } from 'expression-language';

const el = new ExpressionLanguage();

// Validate expressions without executing them
el.lint('a > 0 && myFn(foo)', ['a'], IGNORE_UNKNOWN_FUNCTIONS | IGNORE_UNKNOWN_VARIABLES);

// By default (flags = 0), unknowns throw:
try {
  el.lint('myFn(foo)');
} catch (e) {
  console.warn('Lint failed as expected:', e.message);
}
```

Notes:
- Passing null for the names parameter is deprecated; use IGNORE_UNKNOWN_VARIABLES instead when you want to allow unknown variables.

#### Additional exports
Beyond `ExpressionLanguage` and the providers, the package also exports the lower-level building blocks it's made of, for advanced use cases like catching parse errors by type or persisting a parsed expression:

```javascript
import { Expression, ParsedExpression, SyntaxError, CompileRuntime } from 'expression-language';

const el = new ExpressionLanguage();

try {
  el.parse('1 +');
} catch (e) {
  if (e instanceof SyntaxError) {
    console.log(e.message, e.cursor); // parse errors carry a cursor position (and proposals, when available)
  }
}

// Persist a parsed expression's AST (e.g. across a network boundary) and rebuild it later
const parsed = el.parse('a + b', ['a', 'b']);
const json = JSON.stringify(parsed);
const rebuilt = ParsedExpression.fromJSON(json);
console.log(el.evaluate(rebuilt, { a: 1, b: 2 })); // 3
```

Also exported: `Node`, `Token`, `TokenStream`, `CacheItem`, `OPERATOR_LEFT`, `OPERATOR_RIGHT`, `LogicException`, `DivisionByZeroError`.

## Semantics: Symfony's rules, JavaScript's, or both

PHP and JavaScript do not agree on what `"5" + 1`, `null == false` or `"0" ? a : b` mean. An expression is only worth sharing
between a server and a browser if both give it the same meaning, so you choose which rules operators follow:

| `semantics` | Operators follow | Use it when |
|---|---|---|
| `'symfony'` (default) | PHP 8's rules, written in JavaScript | Symfony may evaluate the same expressions, or you want one meaning everywhere |
| `'js'` | JavaScript's rules | the expressions are only ever evaluated by this library |
| `'portable'` | both: the result both agree on, and a `PortabilityError` where they would not | to check, in tests or while authoring, that expressions mean the same everywhere |

```javascript
const symfony = new ExpressionLanguage();                                 // 'symfony' is the default
const js = new ExpressionLanguage(null, [], { semantics: 'js' });
const portable = new ExpressionLanguage(null, [], { semantics: 'portable' });

symfony.evaluate('"5" + 1');   // 6      (PHP adds numbers)
js.evaluate('"5" + 1');        // "51"   (JavaScript concatenates)
portable.evaluate('"5" + 1');  // throws PortabilityError: "+" is not portable: with "5" and 1, PHP gives 6 and JavaScript gives "51".
portable.evaluate('a + b * 2 > 5', { a: 1, b: 3 }); // true: both agree on numbers
```

What the rules decide:

| | `'symfony'` (PHP) | `'js'` |
|---|---|---|
| `+ - * / % **` | numeric: `"5" + 1` is `6`, `null + 1` is `1`, `"abc" + 1` is a `TypeError`; `%` works on integers | JavaScript's: `"5" + 1` is `"51"`, `"abc" - 1` is `NaN` |
| `==` `!=` `<` `>` `<=` `>=` | PHP 8's: `null == false`, `0 != ""`, `"abc" != 0`, `"10" < "9"` is false (numeric strings compare as numbers), an array is greater than a scalar | JavaScript's: `null == false` is false, `0 == ""` is true |
| `===` `!==` and `in` | arrays are identical when they hold the same keys and identical values: `[1, 2] === [1, 2]`, `[1] in [[1], [2]]` | arrays are compared by identity |
| Truthiness (`!`, `and`, `or`, `xor`, `? :`, `?:`) | `"0"`, `""`, `0`, `[]`, `{}` and `null` are false; `NaN` is true | `"0"`, `[]` and `{}` are true; `NaN` is false |
| `& \| ^ << >> ~` | 64-bit integers (a float or a numeric string is converted first); two strings are combined byte by byte; a negative shift is an error | 32 bits |
| `~` (concatenation), `contains`, `starts with`, `ends with`, `matches` | `true` is `"1"`, `false` and `null` are `""`, a float follows PHP's `precision` (`0.1 + 0.2` is `"0.3"`), an array is a `TypeError` for the string operators | `String(value)`: `"true"`, `"0.30000000000000004"` |
| `..` (range) | like `range()`: `"1".."3"` is `[1, 2, 3]`, `"a".."e"` are the letters; an array is a `TypeError`; more than 10 million items is a `ValueError` | the loop of the operands as they are: `"1"..3` is `["1", 2, 3]`; the same ceiling on the size |
| `list.length`, `list.includes(x)` | an array is not an object: it has no properties nor methods (its items, `list[0]`, are fine) | they work |

The same rules apply wherever the expression goes: to `compile()` (which calls `__runtime.symfony` / `__runtime.portable`),
to a `CompiledExpressionLanguage` and to the PHP it dumps. They are checked against Symfony itself, over every operator and
a pool of 20 kinds of operands (11,780 cases: [SymfonySemantics.test.js](src/__tests__/SymfonySemantics.test.js)).

Choosing the rules for a single call: pass the `SEMANTICS_JS` or `SEMANTICS_PORTABLE` flag to `parse()` or `lint()`, which
wins over the option (`parse('a + b', ['a', 'b'], SEMANTICS_JS)`). A parsed expression remembers the rules it was parsed with.

Performance, on a typical expression with a handful of operators: `evaluate()` costs about 9% more with `'symfony'` than with `'js'` and
about 35% more with `'portable'` (it runs both); compiled code about twice as much (about 100 ns instead of about 50 ns an evaluation, against
some 1,700 ns uncompiled).

`'portable'` is a safety net for what the matrix covers (the operators above); it cannot know about the differences listed below.

## Auditing your expressions for portability

If the same expressions run on a server and in a browser, you want to know which of them depend on the rules of a language.
The package installs a command that tells you, from the expressions alone: it needs no data.

```bash
npm install --save-dev expression-language
npx expression-language-portability --extract ./src ./config      # find the expressions in your source code
npx expression-language-portability rules.json                    # ...or give a list: a JSON array of strings, or one expression per line
npx expression-language-portability rules.txt --fail-on ordinary  # exit with 1 when an expression is not portable, to use it in CI
```

It audits the version of the package it comes with. From a checkout of this repository, run `npm run build` and then `npm run portability -- <the same arguments>`.

`--extract` reads PHP attributes and annotations (`#[IsGranted(expression: ...)]`, `@Security(...)`, `new Expression(...)`, `Assert\Expression`),
YAML and XML configuration (`security:`, `condition:`, `guard:`, `@=...`) and `evaluate()` / `compile()` calls in JavaScript.

Every variable, property chain and function call of an expression (`object.getOwner()`, `is_granted('X')`) is replaced by a placeholder whose type
is inferred from how it is used (an operand of `<` is a number, the left side of `matches` a string...). The expression is then evaluated
with the `'portable'` semantics on values of three kinds:

| Regime | Values | What a failure means |
|---|---|---|
| `ordinary` | typical values of the right type | the expression is not portable *whatever your data is like* (for instance two objects compared with `==`) |
| `edge` | edge values of the right type: `0`, `""`, `"0"`, `[]`, `null` | it is portable as long as such a value never shows up |
| `mixed` | values of the wrong type: numeric strings, `null`... | it is portable as long as the types are right |

```
Share of the audited expressions whose operators mean the same in PHP and in JavaScript, whatever the sample:
  ordinary   80.7%  portable (247/306)   typical values of the right type
  edge       72.5%  portable (222/306)   edge values of the right type (0, "", "0", [], null...)
  mixed       8.5%  portable (26/306)   values of the wrong type (numeric strings, null...)

NOT PORTABLE with ordinary values: 59. Causes (first failing sample of each):
    27  == on two objects with equal contents (distinct instances)
  ...
  is_granted('ROLE_USER') and object.getOwner() == user
      "==" is not portable: with {"id":7} and {"id":7}, PHP gives true and JavaScript gives false.
```

(That is the report for 306 expressions found in open-source Symfony projects.) The report also says how many expressions would give another result with the rules of
2.x (JavaScript's) than with the default ones, which is what to look at before upgrading.

Options: `--samples <n>`, `--seed <n>` (the same seed gives the same report), `--limit <n>`, `--json <file>`, and `--php-symfony <dir>`, which also evaluates every sample with
Symfony's own PHP (needs `php` and a checkout of `symfony/expression-language`, see *Contributing*) and lists the answers that differ. `--help` shows them all.

What it can and cannot tell you: it shows which operators of an expression can give another result in PHP and in JavaScript, and for which kind of value.
It does not know your data, nor what your functions return (they are placeholders); a `mixed` failure is a stress test, not a prediction.

## Known differences from Symfony

JavaScript and PHP are different languages, so a few things cannot be identical whatever the semantics:

| Area | PHP (Symfony) | JavaScript (this library) |
|------|---------------|---------------------------|
| Numbers | distinct `int` and `float`; 64-bit integers | IEEE doubles: `1 === 1.0` is true, an integer above 2^53 is rounded, the last digit of a `**` can differ |
| Strings | bytes | UTF-16: `strlen("é")` is 2 in PHP; `~"é"` complements bytes |
| Arrays and objects | an array is not an object | a hash and a class instance are both objects; `hash["key"]` on a class instance is accepted |
| `matches` | gives `1` or `0` (`preg_match()`), so `(a matches b) ~ ""` is `"1"` or `"0"` | gives `true` or `false`: use it as a condition or compare it, rather than feeding it to string operators |
| Regular expressions | PCRE | ECMAScript: the syntax is nearly the same, the error messages differ, only modifiers `i m s u` exist |
| Errors | PHP `TypeError`, `DivisionByZeroError`, ... | `Error` / `TypeError` with the same wording where possible, `DivisionByZeroError` for `/` and `%` |
| `compile()` | PHP source | JavaScript source (no guards, see [Security notes](#security-notes)) |

## Contributing

Run the tests with `npm test`. The pull request checks ([ci.yml](.github/workflows/ci.yml)) run, and you can run locally:

| Command | Checks |
|---|---|
| `npm test` | the unit tests, on the sources |
| `npm run test:coverage` | the same tests with the sources instrumented (code that `compile()` serialises with `Function#toString()` must stay out of it: see the `istanbul ignore` hints) |
| `npm run test:types` | the TypeScript definitions (`types/test-types.ts`, `tsc --strict`) |
| `npm run build:all && npm run test:build` | the Babel build and the minified browser bundle, which are what gets published |
| `npm run test:package` | `npm pack`, then the tarball installed into a clean project: what is in it, the entry point, the bundle, the `expression-language-portability` command (needs the network) |

The `CI` workflow also audits the runtime dependencies (`npm audit --omit=dev`) and evaluates the PHP that `dumpCompiled()` generates with Symfony's own loader, against a Symfony commit pinned in `SYMFONY_EXPRESSION_LANGUAGE_SHA`: move it on purpose, together with the fixtures.

`src/__tests__/SymfonyParity.test.js` replays `src/__tests__/fixtures/symfony-corpus.json` and compares it with
`src/__tests__/fixtures/symfony-parity.json`, which holds what Symfony's own code answers. After adding expressions to
the corpus, regenerate the fixture with a PHP able to run the component (the Lexer, Parser and Nodes are loaded
directly, `symfony/cache` is not needed):

```bash
git clone --depth 1 https://github.com/symfony/expression-language.git /tmp/symfony-expression-language
php -d xdebug.mode=off -d xdebug.max_nesting_level=-1 scripts/generate-parity-fixtures.php /tmp/symfony-expression-language > src/__tests__/fixtures/symfony-parity.json
```

A difference that cannot be avoided is listed, with its reason, in `KNOWN_DIFFERENCES` of that test.

The operators have a second pair of fixtures, `semantics-spec.json` (operators and operands) and `semantics-parity.json` (Symfony's answers):
`php -d xdebug.mode=off scripts/generate-semantics-fixtures.php /tmp/symfony-expression-language > src/__tests__/fixtures/semantics-parity.json`.

The PHP produced by `CompiledExpressionLanguage` is checked against Symfony's own loader. That needs PHP and the same checkout, so it is
opt-in:

```bash
SYMFONY_EXPRESSION_LANGUAGE_PATH=/tmp/symfony-expression-language npm test -- CompiledExpressionLanguage
```

## Releasing

Releases are cut from GitHub, and `package.json` is never edited by hand:

1. Merge your changes into `main` as usual. Merging does **not** publish anything.
2. Create a new GitHub release with a tag like `v2.8.0`. Paste the matching section of [CHANGELOG.md](CHANGELOG.md) as the release notes (the "Generate release notes" button is a fine start for a minor release, but breaking changes must be spelled out).
3. Publishing the release triggers the [npm-publish workflow](.github/workflows/npm-publish.yml), which sets the package version from the tag, runs the tests, publishes to npm, attaches the `dist` files to the release, and commits the new version back to `main`.

Marking the release as a pre-release (e.g. tag `v3.0.0-beta.1`) publishes it under the `next` npm dist-tag instead of `latest`, and `main` is left untouched.

### For Maintainers

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers). In the package settings on npmjs.org, configure the trusted publisher with the workflow filename `npm-publish.yml`. No other secrets are needed.
