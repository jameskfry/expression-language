# Changelog

## Unreleased

- `scripts/portability-audit.cjs` (`npm run portability`) finds the expressions of a code base and tells which ones do not mean the same thing in PHP and in JavaScript, and
  can compare the answers of this library with Symfony's own PHP for them (see the README).

## 3.0.0

This release brings the library back in line with Symfony's ExpressionLanguage, closes a hole that let expressions read
the host's globals, and fixes `compile()` output that was not valid JavaScript. **It contains breaking changes.**
Everything below is explained, with before/after and how to keep the old behaviour, in
**[UPGRADE-3.0.md](UPGRADE-3.0.md)**.

### ⚠️ Breaking changes

**Security**

- **`constant()` and `enum()` are no longer built in.** They used to resolve any name on `globalThis`
  (`constant("process.env.HOME")` worked). Register `new ConstantFunctionProvider([...allowed names])` to get them
  back, restricted to what you list. Unknown constants now throw instead of returning `undefined`, and the fallback to
  the `values` object is gone.
- **`evaluate()` refuses `constructor`, `prototype`, `__proto__`, `__defineGetter__`, ...** as property, method or item
  (`Access to "constructor" is not allowed.`), unless the object owns such a property.

**Behaviour changes (these now match Symfony)**

- **Operators follow Symfony's (PHP 8's) rules by default** (`semantics: 'symfony'`). `"5" + 1` is `6` (it was `"51"`), `"abc" + 1` is
  a `TypeError`, `null == false` is `true`, `"10" < "9"` is `false`, `"0"` and `[]` are falsy, `[1, 2] === [1, 2]` is `true`,
  bitwise operators work on 64 bits, `true ~ ""` is `"1"`, and `list.length` is an error (an array is not an object in PHP).
  Values of the type you expect behave as before. **To get JavaScript's rules back: `new ExpressionLanguage(null, [], { semantics: 'js' })`.**
  `'portable'` applies both and throws a `PortabilityError` where they would differ: use it in your tests to find what depends on the rules.
  Verified against Symfony over every operator and 20 kinds of operands (11,780 cases).
- **`compile()` needs `CompileRuntime` as `__runtime`** (`__runtime.symfony.add(a, b)`), unless the semantics are `'js'`.

- **`contains`, `starts with` and `ends with` are now case-sensitive** (they ignored case). Restore the old behaviour
  with `new ExpressionLanguage(null, [], { caseInsensitiveStringOperators: true })` or the
  `CASE_INSENSITIVE_STRING_OPERATORS` flag.
- **`and` / `or` / `&&` / `||` / `xor` return booleans**, not one of their operands (`0 || 5` is `true`, was `5`).
- **`/` and `%` by zero throw `DivisionByZeroError`** (they gave `Infinity` / `NaN`).
- **`a ? b` (no `:`) now has a `null` else branch** (it was `a ? a : b`, and `a ? "x"` was `a ? "x" : ""`).
- **String literals are decoded like PHP's `stripcslashes()`**: `"\n"` is a newline and an unknown escape loses its
  backslash. **Backslashes meant for a regex must be doubled** (`"/^\\d+$/"`).
- **`matches`**: any delimiter, modifiers `i m s u` only (`g` is rejected), `SyntaxError` for an invalid pattern,
  `null` matches as an empty string.
- **`in` / `not in`** throw when the right operand is not an array or hash (`"a" in "abc"` used to work).
- **`min()` / `max()`** accept an array like PHP's and throw like PHP's on empty or non-array input
  (`min([3, 1])` was `NaN`).
- **`"a" ~ null`** is `"a"` (it threw).
- **`3..1`** is `[3, 2, 1]` (it was `[]`).
- **Lexer**: `not(x)`, `a and(b)` and `1.` now work; a word operator glued to a `)` (`(a)and b`) no longer does.
- **Nesting limit** is now Symfony's: 256 levels of depth, as a `SyntaxError`. It used to be about 1,000 sub-expressions
  in total, as a plain `Error`, so long flat lists now work and very deep nesting does not.
- **An unclosed `/*` is a syntax error** (it was silently ignored).
- **`SyntaxError#message`** now includes the position, the expression and the "Did you mean" hint (it was only in
  `toString()`). Several runtime error messages were reworded.
- **Methods are called on their object**: `this` works in a method called from an expression (it was `null`).
- **`compile()` output changed** for `~`, `xor`, `and` / `or`, `matches`, the string operators, `in`, `..`, `/`, `%`,
  `??`, `min` / `max` / `count`, hash literals and strings (see the table in the upgrade guide).
- `GetAttrNode#attributes.is_short_circuited` was removed; the `names` array passed to `parse()` is no longer
  reordered; the parse cache now takes the flags into account.

### ✨ New

- **`CompiledExpressionLanguage`**: compile expressions ahead of time and evaluate them without parsing. `dumpCompiled()`
  generates **JavaScript** (default; as an ES module, a CommonJS module or a bare expression) **or PHP** (`{ target: 'php' }`),
  in the format Symfony's own `CompiledExpressionLanguage` loads. See the README.
- **The `semantics` option** (`'symfony'` | `'js'` | `'portable'`), the `SEMANTICS_JS` / `SEMANTICS_PORTABLE` flags, `PortabilityError`.
  A `CompiledExpressionLanguage` dump records the rules it was made with; a PHP dump needs `'symfony'` or `'portable'`.
- `ExpressionFunction` takes an optional PHP compiler (4th argument) and has `withPhpFunction()`; `register()` takes it too.
  The PHP-named functions of the bundled providers, `min`, `max` and `count` already declare it.
- Null-safe array access: `foo?.[0]`.
- `count()` built-in.
- `ConstantFunctionProvider` (allow-listed `constant()` / `enum()`).
- `caseInsensitiveStringOperators` option and `CASE_INSENSITIVE_STRING_OPERATORS` flag.
- `ExpressionLanguage` accepts any iterable of providers, and an `options` argument.
- New exports: `LogicException`, `DivisionByZeroError`, `ConstantFunctionProvider`, `CASE_INSENSITIVE_STRING_OPERATORS`.
- A parity test suite that compares 400+ expressions with Symfony's own results, and
  `scripts/generate-parity-fixtures.php` to regenerate its fixtures. `scripts/verify-compiled-php.php` checks the PHP dump
  with Symfony's own loader.
- `Parser#getVariables()`; `PhpCompiler` is exported.

### 🐛 Fixed

- `compile()` generated invalid JavaScript for `~`, `xor`, `matches`, `contains` / `starts with` / `ends with`, hash
  literals with computed keys, strings containing newlines or control characters, `unknown ?? x` and `a.b.c ?? x`.
- A short-circuited `?.` could leak into a later evaluation of the same parsed expression.
- Parsing with `IGNORE_UNKNOWN_VARIABLES` could make a later strict parse of the same expression succeed (cache key
  ignored the flags).
- An unterminated string followed by another quoted string was mis-lexed.
- "Did you mean ...?" was never offered for unknown function names.

### Still different from Symfony

Numbers are doubles (`1 === 1.0`, integers above 2^53 are rounded), regexes are ECMAScript's, and a hash and a class instance are both objects.
See the [README](README.md#known-differences-from-symfony).

## 2.7.1 and earlier

See the [GitHub releases](https://github.com/jameskfry/expression-language/releases).
