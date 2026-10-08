# Upgrading from 2.x to 3.0

3.0 brings this library back in line with Symfony's ExpressionLanguage (the whole point of the library is that an
expression gives the same answer in the browser and on the server), closes a hole that let expressions read the host's
globals, and fixes `compile()` output that was not valid JavaScript.

That means a number of behaviours change. This guide lists every one of them, with what happened before, what happens
now, and how to get the old behaviour back when that is possible. The short version is in the
[changelog](CHANGELOG.md).

**The biggest change is the default [semantics](#operators-follow-symfonys-rules-the-semantics-option)**: `+`, `==`, `<`, truthiness
and a few more operators now mean what they mean in PHP, so that an expression gives the same result here and in Symfony. If
only this library ever evaluates your expressions and you rely on JavaScript's rules, `new ExpressionLanguage(null, [], { semantics: 'js' })`
restores them.

**Before you upgrade**, search your expressions for: `+` or `==` applied to values that may be strings, `null` or arrays, `constant(`, `enum(`, `contains`, `starts with`, `ends with`,
`matches`, `||` / `or` / `&&` / `and` used for their *value*, `a ? b` without a `:`, `min(` / `max(`, `/` or `%`
with a divisor that can be zero, and `in` with a string on the right. Those are the ones that behave differently.

Everything was verified against Symfony's own PHP code: see
[SymfonyParity.test.js](src/__tests__/SymfonyParity.test.js).

- [Operators follow Symfony's rules: the `semantics` option](#operators-follow-symfonys-rules-the-semantics-option)
- [Security](#security)
  - [`constant()` and `enum()` are no longer built in](#constant-and-enum-are-no-longer-built-in)
  - [Expressions cannot reach `constructor`, `__proto__`, ...](#expressions-cannot-reach-constructor-__proto__-)
- [Behaviour that now matches Symfony](#behaviour-that-now-matches-symfony)
  - [`contains`, `starts with`, `ends with` are case-sensitive](#contains-starts-with-ends-with-are-case-sensitive)
  - [Logical operators return booleans](#logical-operators-return-booleans)
  - [Division and modulo by zero throw](#division-and-modulo-by-zero-throw)
  - [`a ? b` without `:` has a `null` else branch](#a--b-without--has-a-null-else-branch)
  - [String literals are decoded like PHP does](#string-literals-are-decoded-like-php-does)
  - [`matches`](#matches)
  - [`in` / `not in`](#in--not-in)
  - [`min()` and `max()`](#min-and-max)
  - [`~` and `null`](#-and-null)
  - [`..` counts down](#-counts-down)
  - [Lexer](#lexer)
  - [Nesting limit](#nesting-limit)
  - [Unclosed comments](#unclosed-comments)
- [Errors](#errors)
- [Compiled code](#compiled-code)
- [Internals and TypeScript](#internals-and-typescript)
- [New features](#new-features)
- [Still different from Symfony](#still-different-from-symfony)

## Operators follow Symfony's rules: the `semantics` option

Operators used to be JavaScript's. They now follow PHP 8's, like Symfony's ExpressionLanguage does, because an expression is
only worth sharing between a server and a browser if both give it the same meaning. This is the default (`semantics: 'symfony'`).
Values that are of the type you expect (numbers with numbers, strings with strings) give the same results as before; the
differences are for mixed types.

| Expression | Before (JavaScript's) | Now (`'symfony'`) |
|---|---|---|
| `"5" + 1` | `"51"` | `6` |
| `"abc" + 1`, `[] + 1`, `"" * 2` | `"abc1"`, `"1"`, `0` | `TypeError: Unsupported operand types: string + int` |
| `null + 1`, `true + 1` | `1`, `2` | `1`, `2` |
| `null == false`, `0 == ""`, `"abc" == 0` | `false`, `true`, `false` | `true`, `false`, `false` |
| `"10" < "9"` | `true` (alphabetical) | `false` (numeric strings compare as numbers) |
| `[1, 2] === [1, 2]`, `[1] in [[1]]` | `false` (identity) | `true` |
| `"0" ? a : b`, `[] ? a : b`, `not "0"` | `a`, `a`, `false` | `b`, `b`, `true` |
| `1 << 40`, `-1 >> 1`, `5.5 % 2` | `256`, `-1`, `1.5` | `1099511627776`, `-1`, `1` (64-bit integers) |
| `"1"..3`, `"a".."c"` | `["1", 2, 3]`, `["a"]` | `[1, 2, 3]`, `["a", "b", "c"]` (a range of more than 10 million items is now a `ValueError`) |
| `true ~ "x"`, `(0.1 + 0.2) ~ ""` | `"truex"`, `"0.30000000000000004"` | `"1x"`, `"0.3"` |
| `list.length` | `2` | `Unable to get property "length" of non-object "list".` (an array is not an object in PHP; `list[0]` is fine) |

The complete list of what the rules decide is in the [README](README.md#semantics-symfonys-rules-javascripts-or-both).

**To get JavaScript's rules back**, for the whole language or for one call:

```javascript
const el = new ExpressionLanguage(null, [], { semantics: 'js' });
el.parse('a + b', ['a', 'b'], SEMANTICS_JS);   // a single call
```

**To find the expressions that depend on the rules**, use `semantics: 'portable'` in your tests: it applies both sets of rules and
throws a `PortabilityError` ("`+` is not portable: with "5" and 1, PHP gives 6 and JavaScript gives "51"") where they would
give different results. Running your expressions through it with real data is the quickest way to know whether switching matters to you.

Other consequences:

- **`compile()` needs the runtime.** An operator is a call to `__runtime.symfony.add(a, b)` (or `__runtime.portable...`), so
  the code has to run with `CompileRuntime` in scope as `__runtime`, as it already did for provider functions:
  `new Function('__runtime', 'a', 'b', 'return ' + compiled)(CompileRuntime, 1, 2)`. Only `'js'` compiles to code
  that needs nothing. The table in [Compiled code](#compiled-code) shows the `'js'` output.
- A `CompiledExpressionLanguage` dump records the rules it was made with and refuses to be loaded by a language with other ones.
  A PHP dump is refused for `'js'`, since a PHP file always follows PHP's rules.
- The options of a language are part of the cache key: a parsed expression is not shared between languages with different rules,
  and it remembers the rules it was parsed with (`ParsedExpression.fromJSON()` restores them).
- Arrays are compared structurally by `===`, `!==`, `in` and `not in`. Objects that are instances of a class are still compared by identity.
- The cost is small: about 9% for `evaluate()`, about 2x for compiled code (still some 17 times faster than not compiling).

---

## Security

### `constant()` and `enum()` are no longer built in

**Before:** `constant("process.env.HOME")` returned your home directory, `constant("process").cwd()` ran, and
`constant("FOO")` fell back to a key of the values you passed to `evaluate()`. Any expression author could read
whatever is reachable from `globalThis`. Unknown names silently returned `undefined`.

**Now:** the functions do not exist unless you register a `ConstantFunctionProvider` listing what may be read
(the same thing Symfony 8.2 did when it deprecated its built-ins). Anything else throws, a missing constant throws too.

```diff
-const el = new ExpressionLanguage();
+import { ExpressionLanguage, ConstantFunctionProvider } from 'expression-language';
+
+const el = new ExpressionLanguage(null, [
+  new ConstantFunctionProvider(['Math.PI', 'App.Roles.*']),
+]);
 el.evaluate('constant("Math.PI")');
```

- `*` matches within one path segment (`App.Roles.*` allows `App.Roles.ADMIN` but not `App.Roles.Deep.X`).
- PHP style names (`App\Roles::ADMIN`) keep working.
- The `values` fallback is gone. If you relied on it, just use a variable (`FOO` instead of `constant("FOO")`).
- To resolve constants on something other than the global object, pass it as the second argument. Such a provider
  cannot be used with `compile()`.

### Expressions cannot reach `constructor`, `__proto__`, ...

**Before:** `o.constructor`, `o.__proto__`, `o["constructor"]` returned the inherited function / prototype.

**Now:** `evaluate()` throws `Access to "constructor" is not allowed.` for `constructor`, `prototype`, `__proto__`,
`__defineGetter__`, `__defineSetter__`, `__lookupGetter__` and `__lookupSetter__`, through a property, a method call
or an item, **unless the object has an own property of that name** (so data with a `"constructor"` key stays readable).

`compile()` output is plain JavaScript and has no such guard.

---

## Behaviour that now matches Symfony

### `contains`, `starts with`, `ends with` are case-sensitive

**Before:** they ignored case. `"Hello" contains "hello"` was `true`.
**Now:** case-sensitive, like Symfony's `str_contains()` & co. and like JavaScript's own `includes()`.
`null` is an empty string.

To keep the old behaviour:

```javascript
const el = new ExpressionLanguage(null, [], { caseInsensitiveStringOperators: true });
```

or, for one expression, pass the `CASE_INSENSITIVE_STRING_OPERATORS` flag to `parse()` / `lint()`:

```javascript
el.parse('name contains "bob"', ['name'], CASE_INSENSITIVE_STRING_OPERATORS);
```

### Logical operators return booleans

**Before:** `0 || 5` was `5`, `"a" && "b"` was `"b"` (JavaScript semantics).
**Now:** `true` in both cases. `||`, `or`, `&&`, `and` and `xor` always give a boolean.

Use `??` (null-coalescing) or `?:` (elvis) to pick a default instead: `name ?: "anonymous"`.

### Division and modulo by zero throw

**Before:** `1 / 0` was `Infinity`, `1 % 0` was `NaN`.
**Now:** both throw a `DivisionByZeroError` (`Division by zero.` / `Modulo by zero.`), as in PHP. The error class is
exported. A `null` / `undefined` / `"0"` divisor counts as zero.

### `a ? b` without `:` has a `null` else branch

**Before:** `a ? b` meant `a ? a : b`, and `a ? "text"` meant `a ? "text" : ""`.
**Now:** `a ? b` is `a ? b : null`, which is what Symfony's parser does (its documentation says `''`, its code says
`null`). `a ?: b` (elvis) is unchanged. A nested `a ? (b ? c : d)` is no longer rewritten to `a ? b : d`.

### String literals are decoded like PHP does

Symfony runs every string literal through `stripcslashes()`. So do we now.

| Expression text | Before | Now |
|---|---|---|
| `"a\nb"` | backslash, `n` | a real newline (same for `\t \r \a \v \b \f`) |
| `"\x41"`, `"\101"` | unchanged text | `A` |
| `"\d"` | `\d` | `d` (an unknown escape just loses its backslash) |
| `"\\d"` | `\d` | `\d` |

**The one that bites:** a backslash that has to reach a regular expression must be doubled, exactly as in Symfony.

```javascript
// expression text:   x matches "/^\\d+$/"
el.evaluate('x matches "/^\\\\d+$/"', { x: '123' }); // true
// expression text:   x matches "/^\d+$/"   -> the pattern is /^d+$/
```

### `matches`

- Any non-alphanumeric delimiter works (`/re/`, `#re#`, `{re}`), like PCRE. Only the modifiers `i`, `m`, `s` and `u`
  exist: `g`, `y`, `d`, ... are now rejected (they were accepted before, but do not exist in PHP).
- An invalid pattern raises this library's `SyntaxError` (`Regexp "..." passed to "matches" is not valid: ...`), where
  you used to get a `TypeError` or a raw `RegExp` error.
- `null` is matched as an empty string: `null matches "/^$/"` is `true` (it was `false`). Numbers are matched as
  their digits.
- When compiling, a constant pattern is validated at compile time.

### `in` / `not in`

- The right operand must be an array or a hash (whose values are searched). **Before**, a string was accepted and
  searched as a substring (`"a" in "abc"` was `true`); now it throws
  `in_array(): Argument #2 ($haystack) must be of type array, string given`. Use `contains` for substrings.
- Comparison stays strict, as in Symfony 7+.

### `min()` and `max()`

**Before:** thin wrappers around `Math.min` / `Math.max`: `min([3, 1])` was `NaN`, `min()` was `Infinity`, strings gave `NaN`.
**Now:** like PHP. Several values or a single array / hash; strings are compared as strings; `min()`, `min([])` and
`min(4)` throw with PHP's messages.

### `~` and `null`

`"a" ~ null` threw a `TypeError`; it is now `"a"` (`null` is an empty string, as in PHP).

### `..` counts down

`3..1` was `[]`; it is now `[3, 2, 1]`, like PHP's `range()`.

### Lexer

- A word operator may be followed by `(`: `not(x)`, `a and(b)`, `a or(b)`.
- A word operator must stand on its own: preceded by the start of the expression, a space or `(`. `(a)and b` is no
  longer lexed as `(a) and b` (it is a syntax error, as with Symfony): write `(a) and b`.
- `1.` is a number (`1`). `1..5` is still a range.

### Nesting limit

**Before:** the parser stopped with a plain `Error("Too many executions ...")` after about **1,000 sub-expressions in
total**, however flat: a 1,100-element array literal failed.
**Now:** the limit is the **depth** of the expression, 256 levels, and it raises a `SyntaxError`
(`Expression is nested too deeply, the maximum nesting level is 256`), as in Symfony. Long flat lists work; a chain
like `1 + 1 + 1 + ...` of more than 255 terms, or more than 255 nested parentheses, does not.

### Unclosed comments

`1 /* oops` used to silently evaluate to `1`. It is now a syntax error, like in Symfony.

---

## Errors

- `SyntaxError#message` now holds the whole text (`... around position 1 for expression \`zz\`. Did you mean "z"?`),
  as in Symfony. It used to be only in `toString()`, which is unchanged. If you compare messages, compare with
  `toContain()` / a regex.
- The "Did you mean ...?" hint now also works for unknown **functions**.
- Property / method / item access errors were reworded after Symfony's:
  - `Unable to get property "bar" of non-object "foo".`
  - `Unable to call method "bar" of non-object "foo".`
  - `Unable to call method "bar" of object "Object".` (was `Method "bar" is undefined on object.` and `... is not a function on object.`)
  - `Unable to get an item of non-array "foo".`
- Methods are now called **on their object** (`this` works). They used to be called with `this === null`.
- `min`, `max`, `count` and `in` use PHP's wording for argument errors (`count(): Argument #1 ($value) must be of type Countable|array, string given`).

---

## Compiled code

`compile()` output was invalid or wrong for several constructs; it is now checked against `evaluate()` on a corpus of
400+ expressions. If you store or snapshot compiled code, expect different text. (The table shows the output for the `'js'`
semantics; with the default ones every operator is a call to `__runtime.symfony`, see above.)

| Construct | Before | Now |
|---|---|---|
| `a ~ b` | `(a . b)` (a bug) | `(String(a ?? "") + String(b ?? ""))` |
| `a xor b` | `(a xor b)` (a syntax error) | `(!(a) !== !(b))` |
| `a and b` / `a or b` | `(a && b)` | `(!!(a && b))` |
| `s matches "/re/i"` | `"/re/i".test(s)` (a bug) | `(new RegExp("re", "i").test(String(s ?? "")))` |
| `a contains b` & co. | a syntax error | `(String(a ?? "").includes(String(b ?? "")))` |
| `a / b`, `a % b` | `(a / b)` | a small function that throws on zero |
| `min(...)`, `max(...)`, `count(...)` | `Math.min(...)` | a small self-contained function |
| `x ?? "d"` with an undeclared `x` | `ReferenceError` | `null` |
| `a.b.c ?? "d"` | `TypeError` when `a.b` is missing | uses optional chaining |
| `foo?.[0]` | not supported | `foo?.[0]` |
| `{(1 + 1): 2}` | a syntax error | `{[(1 + 1)]: 2}` |
| strings with a newline, `\0`, ... | an invalid literal | a valid literal (`Compiler#string()` now escapes like `JSON.stringify`) |
| `3..1` | `[]` | `[3, 2, 1]` |
| `constant()` / `enum()` | n/a | self-contained, allow list embedded |

---

## Internals and TypeScript

Only relevant if you build on the lower-level classes.

- `GetAttrNode` no longer has an `is_short_circuited` attribute (it was state left on the node by `evaluate()`, which
  leaked from one evaluation into the next); it gained `is_null_safe` and a fifth constructor argument.
  `ParsedExpression.fromJSON()` still reads JSON produced by 2.x.
- `NullCoalesceNode` flags the accesses on its left side when it is **constructed**, no longer when it is evaluated.
- `BinaryNode` takes two optional arguments after the operands (`caseInsensitive`, `semantics`), `UnaryNode` and `ConditionalNode`
  an optional `semantics`, and `GetAttrNode` an optional sixth `semantics` argument. A node written down with `JSON.stringify()` only
  carries `attributes.semantics` when it is not the default.
- `CompileRuntime` gains `symfony`, `portable` and `js`, the operators of each set of rules.
- New flags `SEMANTICS_JS` and `SEMANTICS_PORTABLE` (exclusive), `PortabilityError`.
- `ExpressionLanguage#parse()` / `lint()` / `compile()` no longer sort the `names` array you pass (they used to reorder
  it in place), and the parse cache is keyed by flags as well: parsing `foo` with `IGNORE_UNKNOWN_VARIABLES` can no
  longer make a later, strict `parse('foo', [])` succeed.
- The constructor takes a third `options` argument; `providers` can be any iterable.
- New exports: `ConstantFunctionProvider`, `CASE_INSENSITIVE_STRING_OPERATORS`, `SEMANTICS_JS`, `SEMANTICS_PORTABLE`, `PortabilityError`, `LogicException`, `DivisionByZeroError`.
  The TypeScript definitions cover all of them.
- Hash literals no longer treat a `"__proto__"` key as the prototype of the result.
- `ExpressionFunction` has a fourth, optional constructor argument (a PHP compiler) and `ExpressionLanguage#register()`
  a fourth, optional parameter. A registered function only gets a `phpCompiler` key when one was given.
- A number token remembers whether it was written as a float (`Token#isFloat`, `ConstantNode#isFloat`). It changes
  nothing for evaluation or `compile()`; the PHP dump uses it to write `1.0` and not `1`.
- `Parser#getVariables()` returns the variables read by the last parsed expression.

---

## New features

- The `semantics` option (`'symfony'` by default, `'js'`, `'portable'`), the `SEMANTICS_JS` / `SEMANTICS_PORTABLE` flags and `PortabilityError`.
- `CompiledExpressionLanguage`, with JavaScript and PHP dumps (see the README).
- Null-safe array access: `foo?.[0]`, `foo?.bar?.[1]`.
- `count()` is built in (arrays and hashes). `ArrayProvider`'s `count` (PHP-compatible, with a `mode`) still takes over when registered.
- `ConstantFunctionProvider`: allow-listed `constant()` / `enum()`.
- `caseInsensitiveStringOperators` option and `CASE_INSENSITIVE_STRING_OPERATORS` flag.
- A parity test suite against Symfony itself, and a script to regenerate its fixtures.

---

## Still different from Symfony

A few differences come from the two languages themselves and are documented, not changed, whatever the semantics. The README has the
[full table](README.md#known-differences-from-symfony). The ones most likely to matter:

- Numbers are IEEE doubles: `1 === 1.0` is true, an integer above 2^53 is rounded.
- Regular expressions are ECMAScript's, not PCRE: only the modifiers `i m s u` exist and the error messages differ.
- A hash and an instance of a class are both objects.
