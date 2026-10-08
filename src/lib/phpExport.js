/**
 * Like PHP's var_export(..., true) for the values the generated PHP files need: strings, numbers, booleans, null, arrays, objects.
 *
 * @param {*} value
 * @returns {string}
 */
export function phpExport(value) {
    if (null === value || undefined === value) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return 'NAN';
        }
        if (!Number.isFinite(value)) {
            return value > 0 ? 'INF' : '-INF';
        }
        return String(value);
    }
    if (typeof value === 'string') {
        // a NUL byte cannot sit in a single-quoted string
        return value.split('\0').map((part) => "'" + part.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'").join(' . "\\0" . ');
    }
    if (Array.isArray(value)) {
        return '[' + value.map(phpExport).join(', ') + ']';
    }

    return '[' + Object.keys(value).map((key) => phpExport(key) + ' => ' + phpExport(value[key])).join(', ') + ']';
}
