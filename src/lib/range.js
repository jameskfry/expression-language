/**
 * The largest array `..` builds: PHP refuses an array it cannot hold, and an expression must not be able to hang a server
 * with `0..1000000000000`.
 */
export const MAX_RANGE_ELEMENTS = 10000000;

export function assertRangeSize(count, start, end) {
    if (count > MAX_RANGE_ELEMENTS) {
        const error = new RangeError(`The supplied range exceeds the maximum array size: start=${start}, end=${end}`);
        error.name = 'ValueError';
        throw error;
    }
}

/**
 * Like PHP's range() for numbers: counts up when start <= end and down otherwise.
 */
export function range (start, end) {
    assertRangeSize(Math.abs(end - start) + 1, start, end);

    let result = [];
    if (start <= end) {
        for (let i = start; i <= end; i++) {
            result.push(i);
        }
    }
    else {
        for (let i = start; i >= end; i--) {
            result.push(i);
        }
    }
    return result;
}
