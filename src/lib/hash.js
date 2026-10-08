/**
 * cyrb53: a small, fast, deterministic 53 bit string hash. Not cryptographic; it only has to tell generated files apart.
 */
function cyrb53(str, seed) {
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * @param {string} str
 * @returns {string} 16 hexadecimal characters
 */
export function shortHash(str) {
    return (cyrb53(str, 0).toString(16).padStart(14, '0') + cyrb53(str, 1).toString(16)).slice(0, 16);
}
