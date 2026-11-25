let warnedNullLint = false;

/**
 * Emits a single deprecation warning when `null` is passed as the names argument to `lint()`.
 */
export function warnDeprecatedNullLint() {
    if (warnedNullLint) {
        return;
    }
    warnedNullLint = true;

    const message = 'Passing "null" as the second argument of lint is deprecated, pass IGNORE_UNKNOWN_VARIABLES instead as the third argument';
    if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
        process.emitWarning(message, 'DeprecationWarning', 'DEP_EXPR_LANG_LINT_NULL');
    } else if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`Deprecated: ${message}`);
    }
}
