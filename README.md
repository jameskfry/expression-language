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
| Escapes                 | Backslash escaping in strings and regexes                                    | ✅         |
| Escapes                 | Control characters need escaping (e.g., \n)                                  | ✅         |
| Objects                 | Access public properties with dot syntax (obj.prop)                          | ✅         |
| Objects                 | Call methods with dot syntax (obj.method(...))                               | ✅         |
| Objects                 | Null-safe operator (obj?.prop / obj?.method())                               | ✅         |
| Nullish                 | Null-coalescing operator (a ?? b)                                            | ✅         |
| Functions               | constant()                                                                   | ✅         |
| Functions               | enum()                                                                       | ✅         |
| Functions               | min()                                                                        | ✅         |
| Functions               | max()                                                                        | ✅         |
| Arrays                  | Access array items with bracket syntax (arr[...])                            | ✅         |
| Operators: Arithmetic   | +, -, *, /, %, **                                                            | ✅         |
| Operators: Bitwise      | &, \| , ^                                                                    | ✅         |
| Operators: Bitwise      | ~ (not), <<, >>                                                              | ✅         |
| Operators: Comparison   | ==, ===, !=, !==, <, >, <=, >=                                               | ✅         |
| Operators: Comparison   | matches (regex)                                                              | ✅         |
| Operators: String tests | contains, starts with, ends with                                             | ✅         |
| Operators: Logical      | not/!, and/&&, or/\|\|, xor                                                  | ✅         |
| Operators: String       | ~ (concatenation)                                                            | ✅         |
| Operators: Array        | in, not in (strict comparison)                                               | ✅         |
| Operators: Numeric      | .. (range)                                                                   | ✅         |
| Operators: Ternary      | a ? b : c, a ?: b, a ? b                                                     | ✅         |
| Other                   | Null-safe operator (?.)                                                      | ✅         |
| Other                   | Null-coalescing operator (??)                                                | ✅         |
| Precedence              | Operator precedence as per Symfony docs                                      | ✅         |
| fromPhp()               | Supported as fromJavascript()                                                | ✅         |
| Symfony Built-ins       | Security expression variables                                                | ⛔️        |
| Symfony Built-ins       | Service container expression variables                                       | ⛔️        |
| Symfony Built-ins       | Routing expression variables                                                 | ⛔️        |

> Notes: Symfony Built-ins are not supported in the javascript environment

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
console.log(el.evaluate('mySum(20, 22)')); // 42

// 2) Namespaced (dotted) function requires an explicit expression name
const maxFn = ExpressionFunction.fromJavascript('Math.max', 'max');
el.addFunction(maxFn);
console.log(el.evaluate('max(1, 3, 2)')); // 3

// Note: min/max are already built-in and compile to Math.min/Math.max.
```

> Note: Register functions or providers before calling evaluate(), compile(), or parse(); late registration will throw a LogicException.

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

## Continuous Integration and Deployment

This package uses GitHub Actions for automated workflows:

1. **NPM Publishing**: Automatically publishes to npm when the package version changes
2. **GitHub Releases**: Automatically creates GitHub releases with changelogs and distribution files

### For Maintainers

If you're maintaining this package, you'll need to set up the following:

#### NPM Publishing

1. Generate an npm access token with publish permissions:
    - Go to npmjs.com and log in
    - Click on your profile picture → Access Tokens
    - Click "Generate New Token" → Select "Publish"

2. Add the token to your GitHub repository:
    - Go to your GitHub repository → Settings → Secrets and variables → Actions
    - Click "New repository secret"
    - Name: `NPM_TOKEN`
    - Value: Your npm access token
    - Click "Add secret"

#### GitHub Releases

The GitHub release workflow automatically:

- Checks if the package version has changed
- Builds the project to generate distribution files
- Creates a GitHub release with the new version tag
- Generates a changelog based on commit messages
- Attaches the distribution files to the release

No additional setup is required for GitHub releases as it uses the default `GITHUB_TOKEN`.

Once set up, any push to the main branch will trigger these workflows when the package version changes.

