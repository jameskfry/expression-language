#!/usr/bin/env node
/*
 * Portability audit: do your expressions mean the same thing in PHP (Symfony) and in JavaScript?
 *
 * Operators do not behave alike in the two languages (`"5" + 1`, `null == false`, `"0" ? a : b`, `owner == user` on two objects...).
 * This script takes expressions (read from a file, from stdin, or extracted from the source code of a project), and tells which ones
 * depend on that.
 *
 * It has expressions but no data, so every "leaf" of an expression (a variable, a property / method chain such as
 * `object.getOwner()`, a function call such as `is_granted('X')`) is replaced by a placeholder, the type it should have is inferred
 * from how it is used (an operand of `<` is a number, the left side of `matches` a string...), and the expression is evaluated with
 * the "portable" semantics (see the README) on values drawn in three regimes:
 *
 *   ordinary   typical values of the right type
 *   edge       edge values of the right type: 0, "", "0", [], null...
 *   mixed      values of the wrong type: numeric strings for numbers, null for anything...
 *
 * An expression is NOT PORTABLE for a regime when at least one sample makes an operator give another result with PHP's rules than with
 * JavaScript's. That is a statement about the expression, not about your data: what it takes for the data to be safe is the cause shown.
 *
 * Usage:
 *
 *   npx expression-language-portability [options] [file ...]      (once the package is installed)
 *   node bin/portability-audit.cjs [options] [file ...]            (from a checkout of the repository)
 *
 *   file                    a JSON file (an array of strings, or of {expr: "..."}), or a text file with one expression per line
 *                           (blank lines and lines starting with # are ignored). "-" reads the standard input.
 *   --extract <dir>         extract the expressions from the source code under <dir> (can be repeated): PHP attributes and
 *                           annotations (#[IsGranted(expression: ...)], @Security, Expression(...)), YAML / XML configuration
 *                           (security:, condition:, guard:, @=...), and evaluate() / compile() calls in JavaScript
 *   --samples <n>           samples per expression and regime (default 300)
 *   --seed <n>              seed of the random values (default 20261008): the same seed gives the same report
 *   --limit <n>             expressions listed per section (default 15, 0 for all)
 *   --json <file>           write the whole report to a file
 *   --fail-on <regime>      exit with 1 when an expression is not portable for this regime (ordinary, edge or mixed)
 *   --php-symfony <dir>     also evaluate the samples with Symfony's own PHP and compare (needs php, and a checkout of
 *                           symfony/expression-language; see the README, "Contributing")
 *   --php <binary>          the php to use (default: php)
 *   --lib <path>            the expression-language build to audit (default: the one this script comes with: the installed package, or
 *                           lib/ of a checkout, which `npm run build` makes)
 *   --help
 *
 * Exits with 0, 1 (see --fail-on, or a disagreement with PHP) or 2 (wrong usage).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const REGIMES = ['ordinary', 'edge', 'mixed'];
const DEFAULT_SEED = 20261008;

// ------------------------------------------------------------------------------------------------------------------------------
// reading expressions
// ------------------------------------------------------------------------------------------------------------------------------

/**
 * @param {string} text
 * @param {string} name What it was read from
 * @returns {{expr: string, sources: Array}[]}
 */
function parseExpressionList(text, name) {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const data = JSON.parse(trimmed);
        const list = Array.isArray(data) ? data : data.expressions;
        if (!Array.isArray(list)) {
            throw new Error(`${name}: expected a JSON array of expressions`);
        }

        return list.map((item) => {
            const expr = typeof item === 'string' ? item : (item.expr ?? item.expression);
            if (typeof expr !== 'string') {
                throw new Error(`${name}: an entry has no "expr"`);
            }

            return {expr, sources: item.sources ?? [{file: name, ctx: 'list'}]};
        });
    }

    return text.split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map((expr) => ({expr, sources: [{file: name, ctx: 'list'}]}));
}

// ------------------------------------------------------------------------------------------------------------------------------
// extracting expressions from source code
// ------------------------------------------------------------------------------------------------------------------------------

const QUOTED = String.raw`(?<q>['"])(?<e>(?:\\.|(?!\k<q>)[^\\])*)\k<q>`;
const KEYS = 'security|securityPostDenormalize|securityPostValidation|expression|condition|guard';

const EXTRACTORS = [
    // security: '...'   'security' => '...'   condition="..."
    ['key', new RegExp(String.raw`['"]?\b(?:${KEYS})['"]?\s*(?:=>|:|=)\s*${QUOTED}`, 'g')],
    // new Expression('...')  @Security("...")  #[Security('...')]  Assert\Expression("...")
    ['call', new RegExp(String.raw`(?:\bnew\s+)?(?:Assert\\)?\b(?:Expression|Security)\(\s*${QUOTED}`, 'g')],
    // expression("...") in a service definition
    ['service', new RegExp(String.raw`\bexpression\(\s*${QUOTED}\s*\)`, 'g')],
    // '@=...' : the shortcut of a service definition, quoted (arguments: ['@=service("x").y()'])
    ['shortcut', new RegExp(String.raw`(?<q>['"])@=(?<e>(?:\\.|(?!\k<q>)[^\\])*)\k<q>`, 'g')],
    // evaluate('...')  compile('...')  parse('...')  lint('...') in JavaScript
    ['js-call', new RegExp(String.raw`\.(?:evaluate|compile|parse|lint)\(\s*${QUOTED}`, 'g')],
];
const XML_ELEMENT = /<[\w:]*(?:guard|expression|condition)[^>]*>(?<e>[^<]+)<\/[\w:]*(?:guard|expression|condition)>/g;
const YAML_SHORTCUT = /^\s*(?:-|[\w'".]+\s*:)\s*['"]?@=(?<e>.+?)['"]?\s*$/;
const YAML_BARE = new RegExp(String.raw`^\s*-?\s*(?:${KEYS})\s*:\s*(?<e>[^'"\s#][^#]*?)\s*$`);

const EXTENSIONS = new Set(['.php', '.yaml', '.yml', '.xml', '.rst', '.md', '.twig', '.neon', '.json', '.txt', '.dist', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.vue']);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'vendor', 'translations', 'locale', 'locales', 'var', 'cache', 'dist', 'lib', 'coverage']);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ENTITIES = {'&quot;': '"', '&#039;': "'", '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&'};
const decodeEntities = (text) => text.replace(/&(?:quot|#0?39|apos|lt|gt|amp);/g, (entity) => ENTITIES[entity]);

function unescapeString(raw, quote) {
    return decodeEntities(quote === "'" ? raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\') : raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
}

/**
 * @param {string} text The content of a file
 * @param {string} file Its name
 * @param {Map<string, Array>} found Receives expression => where it was found
 */
function extractFromText(text, file, found) {
    const add = (expr, ctx) => {
        expr = expr.trim();
        if (expr === '' || expr.length > 400 || expr.includes('\n')) {
            return;
        }
        if (!found.has(expr)) {
            found.set(expr, []);
        }
        found.get(expr).push({file, ctx});
    };

    for (const [ctx, regex] of EXTRACTORS) {
        for (const match of text.matchAll(regex)) {
            add(unescapeString(match.groups.e, match.groups.q), ctx);
        }
    }
    for (const match of text.matchAll(XML_ELEMENT)) {
        add(decodeEntities(match.groups.e), 'xml');
    }
    for (const line of text.split('\n')) {
        const shortcut = YAML_SHORTCUT.exec(line);
        if (shortcut) {
            add(shortcut.groups.e, 'yaml@=');
        }
        const bare = YAML_BARE.exec(line);
        if (bare && !['true', 'false', 'null', '~'].includes(bare.groups.e.toLowerCase())) {
            add(bare.groups.e, 'yaml-bare');
        }
    }
}

/**
 * @param {string} root A directory (or a file)
 * @returns {{expr: string, sources: Array}[]}
 */
function extractFromTree(root) {
    const found = new Map();
    const visit = (target) => {
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            for (const name of fs.readdirSync(target)) {
                if (!SKIPPED_DIRECTORIES.has(name)) {
                    visit(path.join(target, name));
                }
            }
        } else if (stat.isFile() && stat.size <= MAX_FILE_SIZE && EXTENSIONS.has(path.extname(target).toLowerCase())) {
            extractFromText(fs.readFileSync(target, 'utf8'), path.relative(root, target) || path.basename(target), found);
        }
    };
    visit(root);

    return [...found].map(([expr, sources]) => ({expr, sources}));
}

// ------------------------------------------------------------------------------------------------------------------------------
// values
// ------------------------------------------------------------------------------------------------------------------------------

const POOLS = {
    ordinary: {
        bool: [true, false],
        number: [1, 2, 5, 10, 100, 2.5, 42],
        string: ['abc', 'Hello', 'ROLE_USER', 'john@example.com', 'draft', 'GET'],
        array: [[1, 2, 3], ['a', 'b'], ['ROLE_USER', 'ROLE_ADMIN'], ['GET', 'HEAD']],
        entity: [{id: 1, name: 'a'}, {id: 2, name: 'b'}, {id: 7}],
        nullable: [null, 'abc', 5, {id: 1}],
    },
    edge: {
        bool: [true, false],
        number: [0, -1, 0.5, 1000],
        string: ['', '0', ' ', 'a b', '0.0'],
        array: [[], [0], [[]], ['']],
        entity: [null, {id: 0}],
        nullable: [null, '', 0, {id: 0}],
        any: [null, 0, '', '0', [], false, {}],
    },
    mixed: {
        bool: [1, 0, '1', '0', null],
        number: ['5', '5.5', '', 'abc', null, true, '10 apples', ' 7', '0'],
        string: [5, 0, null, true, false, 1.5, [], '5'],
        array: ['abc', null, 'a,b', {a: 1}, 5, ''],
        entity: ['abc', 5, [], null, '1'],
        nullable: ['abc', 5, [], true],
        any: [5, '5', null, '', 'abc', true, [], {a: 1}, 0, '0'],
    },
};
POOLS.ordinary.any = [].concat(POOLS.ordinary.bool, POOLS.ordinary.number, POOLS.ordinary.string, POOLS.ordinary.entity);

const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** A small deterministic generator, so that a report can be reproduced. */
function createRandom(seed) {
    let state = seed >>> 0;
    const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

        return state / 4294967296;
    };

    return {next, pick: (list) => list[Math.floor(next() * list.length)]};
}

// ------------------------------------------------------------------------------------------------------------------------------
// the audit
// ------------------------------------------------------------------------------------------------------------------------------

const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '**']);
const BITWISE = new Set(['&', '|', '^', '<<', '>>']);
const ORDERING = new Set(['<', '>', '<=', '>=']);
const EQUALITY = new Set(['==', '!=', '===', '!==']);
const LOGICAL = new Set(['and', 'or', 'xor', '&&', '||']);
const STRING_OPERATORS = new Set(['contains', 'starts with', 'ends with']);
const LEAF_NODES = new Set(['NameNode', 'NullCoalescedNameNode', 'GetAttrNode', 'FunctionNode']);

// names that suggest a method or a function answers true / false
const BOOLEAN_NAME = /(^|\.)(is|has|can|are|was)[A-Z_]|^is_|^has_|is_granted|is_authenticated|is_fully|is_remember|isGranted|\.empty|\.enabled|\.active/;

function literalFamily(node) {
    if (node.name !== 'ConstantNode') {
        return null;
    }
    const value = node.attributes.value;
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'bool';

    return value === null ? 'nullish' : null;
}

function arrayLiteralFamily(node) {
    if (node.name !== 'ArrayNode') {
        return null;
    }
    const families = new Set(node.getKeyValuePairs().map((pair) => literalFamily(pair.value)));

    return families.size === 1 ? [...families][0] : 'string';
}

function safeDump(node) {
    try {
        return node.dump();
    } catch (e) {
        return node.name;
    }
}

/**
 * Replaces every leaf of a tree by a placeholder, and says what is known about each one.
 */
function rewrite(root, Placeholder) {
    const leaves = [];
    const operators = [];

    function visit(node, parent, key, expected, context) {
        if (LEAF_NODES.has(node.name)) {
            const leaf = {index: leaves.length, text: safeDump(node), expected, context, group: null};
            leaves.push(leaf);
            const replacement = new Placeholder('__L' + leaf.index);
            if (parent) {
                parent.nodes[key] = replacement;
            }

            return replacement;
        }

        switch (node.name) {
            case 'BinaryNode': {
                const operator = node.attributes.operator;
                operators.push(operator);
                const {left, right} = node.nodes;
                const rightLiteral = literalFamily(right);
                const leftLiteral = literalFamily(left);
                let leftExpected = 'any';
                let rightExpected = 'any';

                if (ARITHMETIC.has(operator) || BITWISE.has(operator) || operator === '..') {
                    leftExpected = rightExpected = 'number';
                } else if (ORDERING.has(operator)) {
                    leftExpected = rightLiteral && rightLiteral !== 'nullish' ? rightLiteral : 'number';
                    rightExpected = leftLiteral && leftLiteral !== 'nullish' ? leftLiteral : 'number';
                } else if (EQUALITY.has(operator)) {
                    leftExpected = rightLiteral === 'nullish' ? 'nullable' : (rightLiteral || 'same');
                    rightExpected = leftLiteral === 'nullish' ? 'nullable' : (leftLiteral || 'same');
                } else if (operator === 'in' || operator === 'not in') {
                    const element = arrayLiteralFamily(right) || leftLiteral || 'string';
                    leftExpected = element === 'nullish' ? 'string' : element;
                    rightExpected = 'array:' + leftExpected;
                } else if (STRING_OPERATORS.has(operator) || operator === 'matches' || operator === '~') {
                    leftExpected = rightExpected = 'string';
                } else if (LOGICAL.has(operator)) {
                    leftExpected = rightExpected = 'boolish';
                }

                visit(left, node, 'left', leftExpected, `${operator} (left)`);
                visit(right, node, 'right', rightExpected, `${operator} (right)`);

                // two leaves compared together hold the same kind of value
                const isPlaceholder = (child) => child.name === 'NameNode' && /^__L\d+$/.test(child.attributes.name);
                if (EQUALITY.has(operator) && isPlaceholder(node.nodes.left) && isPlaceholder(node.nodes.right)) {
                    const a = leaves[Number(node.nodes.left.attributes.name.slice(3))];
                    const b = leaves[Number(node.nodes.right.attributes.name.slice(3))];
                    a.group = b.group = 'g' + a.index;
                }

                return node;
            }
            case 'UnaryNode': {
                const operator = node.attributes.operator.trim();
                operators.push('unary ' + operator);
                visit(node.nodes.node, node, 'node', operator === '!' || operator === 'not' ? 'boolish' : 'number', 'unary ' + operator);

                return node;
            }
            case 'ConditionalNode':
                operators.push('?:');
                visit(node.nodes.expr1, node, 'expr1', 'boolish', 'condition');
                visit(node.nodes.expr2, node, 'expr2', expected, 'branch');
                visit(node.nodes.expr3, node, 'expr3', expected, 'branch');

                return node;
            case 'NullCoalesceNode':
                operators.push('??');
                visit(node.nodes.expr1, node, 'expr1', expected, '?? (left)');
                visit(node.nodes.expr2, node, 'expr2', expected, '?? (right)');

                return node;
            case 'ArrayNode':
                for (const key of Object.keys(node.nodes)) {
                    visit(node.nodes[key], node, key, 'any', 'array element');
                }

                return node;
        }

        return node;
    }

    return {tree: visit(root, null, null, 'any', 'result'), leaves, operators};
}

function resolveFamily(leaf) {
    if (leaf.expected === 'boolish') {
        // `isActive()` answers true or false; `name` or `user.owner` could be a string, a number, an object, null...
        return BOOLEAN_NAME.test(leaf.text) ? 'bool' : 'any';
    }

    return leaf.expected === 'nullish' ? 'any' : leaf.expected;
}

function sameValue(a, b) {
    if (Object.is(a, b) || a === b) {
        return true;
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return Number.isNaN(a) && Number.isNaN(b);
    }
    if (a === undefined || b === undefined) {
        return (a ?? null) === (b ?? null);
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index] && sameValue(a[key], b[key]));
}

/**
 * @param {Object} lib An expression-language build (>= 3.0)
 * @param {{samples?: number, seed?: number, phpSamples?: number}} options
 */
function createAuditor(lib, {samples = 300, seed = DEFAULT_SEED, phpSamples = 60} = {}) {
    const {Parser, tokenize, IGNORE_UNKNOWN_VARIABLES, IGNORE_UNKNOWN_FUNCTIONS, SEMANTICS_JS, SEMANTICS_PORTABLE, PortabilityError} = lib;
    for (const [name, value] of Object.entries({Parser, tokenize, IGNORE_UNKNOWN_VARIABLES, IGNORE_UNKNOWN_FUNCTIONS, SEMANTICS_JS, SEMANTICS_PORTABLE, PortabilityError})) {
        if (value === undefined) {
            throw new Error(`This is not expression-language 3.0 or later: "${name}" is missing.`);
        }
    }

    const parse = (expression, semantics) => new Parser({}).parse(tokenize(expression), [], IGNORE_UNKNOWN_VARIABLES | IGNORE_UNKNOWN_FUNCTIONS | semantics);
    // the class of the nodes that stand for a variable, without importing it
    const Placeholder = parse('x', 0).constructor;
    const random = createRandom(seed);

    function drawFamily(family, regime) {
        if (family.startsWith('array:')) {
            if (regime === 'mixed') {
                return random.pick(POOLS.mixed.array);
            }
            if (regime === 'edge' && random.next() < 0.5) {
                return [];
            }
            const list = [];
            for (let i = Math.floor(random.next() * 4); i > 0; i--) {
                list.push(drawFamily(family.slice(6), regime));
            }

            return list;
        }

        return clone(random.pick(POOLS[regime][family] || POOLS[regime].any));
    }

    function sampleValues(leaves, regime) {
        const values = {};
        const groupFamilies = {};
        for (const leaf of leaves) {
            let family = resolveFamily(leaf);
            if (family === 'same') {
                const group = leaf.group || 'solo' + leaf.index;
                groupFamilies[group] = groupFamilies[group] || random.pick(['entity', 'string', 'number']);
                family = groupFamilies[group];
            }
            values['__L' + leaf.index] = drawFamily(family, regime);
        }
        // leaves compared together are equal now and then (as equal but distinct instances, for objects)
        const groups = {};
        for (const leaf of leaves) {
            if (leaf.group) {
                (groups[leaf.group] = groups[leaf.group] || []).push(leaf);
            }
        }
        for (const members of Object.values(groups)) {
            if (members.length === 2 && regime !== 'mixed' && random.next() < 0.45) {
                values['__L' + members[1].index] = clone(values['__L' + members[0].index]);
            }
        }

        return values;
    }

    const evaluate = (tree, values) => {
        try {
            return {value: tree.evaluate({}, clone(values))};
        } catch (error) {
            return {error};
        }
    };

    /**
     * @param {{expr: string, sources?: Array}[]} entries
     */
    function audit(entries) {
        const results = [];
        const unparseable = [];
        const cases = [];

        for (const entry of entries) {
            const expression = entry.expr;
            let symfony, js, portable;
            try {
                symfony = rewrite(parse(expression, 0), Placeholder);
                js = rewrite(parse(expression, SEMANTICS_JS), Placeholder);
                portable = rewrite(parse(expression, SEMANTICS_PORTABLE), Placeholder);
            } catch (error) {
                unparseable.push({expr: expression, sources: entry.sources, reason: String(error.message).split('\n')[0].slice(0, 120)});
                continue;
            }

            if (symfony.leaves.length === 0 || symfony.tree.name === 'NameNode') {
                results.push({expr: expression, sources: entry.sources, trivial: true, operators: symfony.operators});
                continue;
            }

            let text = null;
            try {
                text = symfony.tree.dump();
                parse(text, 0);
            } catch (error) {
                text = null;
            }

            const record = {
                expr: expression,
                sources: entry.sources,
                trivial: false,
                leaves: symfony.leaves.map(({text: leafText, expected, context}) => ({text: leafText, expected, context})),
                operators: [...new Set(symfony.operators)],
                regimes: {},
            };

            for (const regime of REGIMES) {
                const summary = {samples, notPortable: 0, resultChanges: 0, otherErrors: 0, byOperator: {}, example: null, changeExample: null};
                for (let i = 0; i < samples; i++) {
                    const values = sampleValues(symfony.leaves.map((leaf, index) => Object.assign({}, leaf, {group: js.leaves[index].group})), regime);
                    const fromSymfony = evaluate(symfony.tree, values);
                    const fromJs = evaluate(js.tree, values);
                    const fromPortable = evaluate(portable.tree, values);

                    if (text && i < phpSamples) {
                        cases.push({expr: expression, regime, text, values, ours: 'error' in fromSymfony ? {error: `${fromSymfony.error.name}: ${fromSymfony.error.message}`} : {value: fromSymfony.value === undefined ? null : fromSymfony.value}});
                    }

                    if (fromPortable.error instanceof PortabilityError) {
                        summary.notPortable++;
                        summary.byOperator[fromPortable.error.operator] = (summary.byOperator[fromPortable.error.operator] || 0) + 1;
                        summary.example = summary.example || {values, message: fromPortable.error.message};
                    } else if (fromPortable.error) {
                        summary.otherErrors++;
                    }

                    // would going from JavaScript's rules (2.x) to Symfony's (the default of 3.0) change what the expression gives?
                    const symfonyFailed = 'error' in fromSymfony;
                    const jsFailed = 'error' in fromJs;
                    if (symfonyFailed !== jsFailed || (!symfonyFailed && !sameValue(fromSymfony.value, fromJs.value))) {
                        summary.resultChanges++;
                        summary.changeExample = summary.changeExample || {
                            values,
                            symfony: symfonyFailed ? `${fromSymfony.error.name}: ${fromSymfony.error.message}` : fromSymfony.value,
                            js: jsFailed ? `${fromJs.error.name}: ${fromJs.error.message}` : fromJs.value,
                        };
                    }
                }
                record.regimes[regime] = summary;
            }
            results.push(record);
        }

        return {results, unparseable, cases};
    }

    return {audit};
}

// ------------------------------------------------------------------------------------------------------------------------------
// comparison with Symfony's own PHP
// ------------------------------------------------------------------------------------------------------------------------------

function normalizeForComparison(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : {$special: String(value)};
    }
    if (value === undefined) {
        return null;
    }
    if (Array.isArray(value)) {
        return value.map(normalizeForComparison);
    }
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value);

        return keys.length === 0 ? [] : Object.fromEntries(keys.map((key) => [key, normalizeForComparison(value[key])]));
    }

    return value;
}

function closeNumbers(a, b) {
    return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Compares the results of the library (default semantics) with those of Symfony's own PHP for the same expressions and values.
 *
 * @param {Array} cases From the audit
 * @param {{php?: string, symfonyPath: string}} options
 */
function crossCheckWithPhp(cases, {php = 'php', symfonyPath}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portability-audit-'));
    try {
        const casesFile = path.join(directory, 'cases.json');
        fs.writeFileSync(casesFile, JSON.stringify(cases.map(({text, values}) => ({text, values}))));

        const run = childProcess.spawnSync(php, ['-d', 'xdebug.mode=off', '-d', 'xdebug.max_nesting_level=-1', path.join(__dirname, 'portability-audit.php'), symfonyPath, casesFile], {encoding: 'utf8', maxBuffer: 1 << 30});
        if (run.error || run.status !== 0) {
            throw new Error(`php failed: ${run.error ? run.error.message : (run.stderr || run.stdout).trim().slice(0, 300)}`);
        }
        const results = JSON.parse(run.stdout);

        const differences = [];
        let same = 0;
        cases.forEach((one, index) => {
            const ours = one.ours;
            const theirs = results[index];
            let equal;
            if ('error' in ours && 'error' in theirs) {
                equal = true; // both refuse: the wording is each engine's own
            } else if ('error' in ours || 'error' in theirs) {
                equal = false;
            } else {
                let a = normalizeForComparison(ours.value);
                const b = normalizeForComparison(theirs.value);
                if (typeof a === 'boolean' && typeof b === 'number') {
                    a = Number(a); // preg_match() gives 1 / 0
                }
                equal = closeNumbers(a, b) || JSON.stringify(a) === JSON.stringify(b);
            }
            if (equal) {
                same++;
            } else {
                differences.push({expr: one.expr, regime: one.regime, text: one.text, values: one.values, ours, php: theirs});
            }
        });

        return {total: cases.length, same, differences};
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

// ------------------------------------------------------------------------------------------------------------------------------
// the report
// ------------------------------------------------------------------------------------------------------------------------------

const MESSAGE = /^"([^"]+)" is not portable: with (.*), PHP gives (.*) and JavaScript gives (.*)\.$/s;

function describeCause(message) {
    const match = MESSAGE.exec(message);
    if (!match) {
        return 'other';
    }
    const [, operator, operands] = match;
    if (EQUALITY.has(operator)) {
        return (operands.match(/\{/g) || []).length >= 2 ? `${operator} on two objects with equal contents (distinct instances)` : `${operator} on scalars or arrays`;
    }

    return operator;
}

const percent = (part, whole) => (whole === 0 ? '  0.0' : (100 * part / whole).toFixed(1).padStart(5));

/**
 * @param {{results: Array, unparseable: Array}} audit
 * @param {{read: number, limit: number, phpCheck?: Object}} options
 * @returns {string}
 */
function formatReport({results, unparseable}, {read, limit = 15, phpCheck = null}) {
    const audited = results.filter((result) => !result.trivial);
    const trivial = results.length - audited.length;
    const lines = [];
    const out = (line = '') => lines.push(line);
    const cap = (list) => (limit > 0 ? list.slice(0, limit) : list);

    out('Portability audit');
    out('=================');
    out(`expressions read             : ${read}`);
    out(`  not parseable              : ${unparseable.length}`);
    out(`  trivial (nothing to audit) : ${trivial}   a bare name, or a single call: no operator is involved`);
    out(`  audited                    : ${audited.length}`);
    out();

    if (audited.length === 0) {
        out('Nothing to audit.');
    } else {
        out('Share of the audited expressions whose operators mean the same in PHP and in JavaScript, whatever the sample:');
        const labels = {
            ordinary: 'typical values of the right type',
            edge: 'edge values of the right type (0, "", "0", [], null...)',
            mixed: 'values of the wrong type (numeric strings, null...)',
        };
        for (const regime of REGIMES) {
            const portable = audited.filter((result) => result.regimes[regime].notPortable === 0).length;
            out(`  ${regime.padEnd(9)} ${percent(portable, audited.length)}%  portable (${portable}/${audited.length})   ${labels[regime]}`);
        }
        const withRightTypes = audited.filter((result) => result.regimes.ordinary.notPortable === 0 && result.regimes.edge.notPortable === 0).length;
        const robust = audited.filter((result) => REGIMES.every((regime) => result.regimes[regime].notPortable === 0)).length;
        out(`  portable with typical AND edge values: ${withRightTypes}/${audited.length} (${percent(withRightTypes, audited.length).trim()}%)`);
        out(`  portable for every regime: ${robust}/${audited.length}`);
        out();

        const changes = audited.filter((result) => result.regimes.ordinary.resultChanges > 0).length;
        out(`With typical values, ${changes}/${audited.length} give another result with Symfony's rules (the default of 3.0) than with JavaScript's (what 2.x did).`);
        out();

        for (const regime of ['ordinary', 'edge']) {
            const bad = audited.filter((result) => result.regimes[regime].notPortable > 0);
            if (bad.length === 0) {
                continue;
            }
            const causes = new Map();
            for (const result of bad) {
                const cause = describeCause(result.regimes[regime].example.message);
                causes.set(cause, (causes.get(cause) || 0) + 1);
            }
            out(`NOT PORTABLE with ${regime} values: ${bad.length}. Causes (first failing sample of each):`);
            for (const [cause, count] of [...causes].sort((a, b) => b[1] - a[1])) {
                out(`  ${String(count).padStart(4)}  ${cause}`);
            }
            out();
            for (const result of cap(bad)) {
                const example = result.regimes[regime].example;
                out(`  ${result.expr}`);
                out(`      ${example.message}`);
            }
            if (limit > 0 && bad.length > limit) {
                out(`  ... and ${bad.length - limit} more (--limit 0 lists all, --json writes everything)`);
            }
            out();
        }

        const onlyWrongTypes = audited.filter((result) => result.regimes.ordinary.notPortable === 0 && result.regimes.edge.notPortable === 0 && result.regimes.mixed.notPortable > 0);
        out(`Portable as long as the types are right, not when they are not: ${onlyWrongTypes.length}`);
        const operators = new Map();
        for (const result of onlyWrongTypes) {
            for (const operator of Object.keys(result.regimes.mixed.byOperator)) {
                operators.set(operator, (operators.get(operator) || 0) + 1);
            }
        }
        out(`  what breaks them (expressions): ${[...operators].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([operator, count]) => `${operator}: ${count}`).join(', ') || '-'}`);
        for (const result of cap(onlyWrongTypes)) {
            out(`  ${result.expr}`);
            out(`      ${result.regimes.mixed.example.message}`);
        }
        out();

        const usage = new Map();
        for (const result of audited) {
            for (const operator of result.operators) {
                usage.set(operator, (usage.get(operator) || 0) + 1);
            }
        }
        out(`Operators used (expressions): ${[...usage].sort((a, b) => b[1] - a[1]).map(([operator, count]) => `${operator}: ${count}`).join(', ')}`);
        out();
    }

    if (unparseable.length > 0) {
        out(`Not parseable (${unparseable.length}): usually text that is not an expression, or syntax the language does not have`);
        for (const item of cap(unparseable)) {
            out(`  ${item.expr.slice(0, 100)}   <- ${item.reason}`);
        }
        out();
    }

    if (phpCheck) {
        out("Comparison with Symfony's own PHP (default semantics, same expressions, same values)");
        out(`  ${phpCheck.same}/${phpCheck.total} identical${phpCheck.differences.length === 0 ? '' : `, ${phpCheck.differences.length} different:`}`);
        for (const difference of cap(phpCheck.differences)) {
            out(`  ${difference.expr}   (${difference.regime})`);
            out(`      values: ${JSON.stringify(difference.values).slice(0, 120)}`);
            out(`      this library: ${JSON.stringify(difference.ours).slice(0, 100)}`);
            out(`      PHP         : ${JSON.stringify(difference.php).slice(0, 100)}`);
        }
        out();
    }

    return lines.join('\n');
}

// ------------------------------------------------------------------------------------------------------------------------------
// command line
// ------------------------------------------------------------------------------------------------------------------------------

function parseArguments(argv) {
    const options = {files: [], extract: [], samples: 300, seed: DEFAULT_SEED, limit: 15, json: null, failOn: null, phpSymfony: null, php: 'php', lib: path.join(__dirname, '..', 'lib', 'index.js'), help: false};
    const takeValue = (index, name) => {
        if (index + 1 >= argv.length) {
            throw new Error(`${name} needs a value.`);
        }

        return argv[index + 1];
    };
    const takeNumber = (index, name) => {
        const value = Number(takeValue(index, name));
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`${name} needs a whole number.`);
        }

        return value;
    };

    for (let i = 0; i < argv.length; i++) {
        const argument = argv[i];
        switch (argument) {
            case '--help': case '-h': options.help = true; break;
            case '--extract': options.extract.push(takeValue(i++, argument)); break;
            case '--samples': options.samples = takeNumber(i++, argument); break;
            case '--seed': options.seed = takeNumber(i++, argument); break;
            case '--limit': options.limit = takeNumber(i++, argument); break;
            case '--json': options.json = takeValue(i++, argument); break;
            case '--fail-on': options.failOn = takeValue(i++, argument); break;
            case '--php-symfony': options.phpSymfony = takeValue(i++, argument); break;
            case '--php': options.php = takeValue(i++, argument); break;
            case '--lib': options.lib = takeValue(i++, argument); break;
            default:
                if (argument.startsWith('--')) {
                    throw new Error(`Unknown option ${argument}.`);
                }
                options.files.push(argument);
        }
    }

    if (options.failOn !== null && !REGIMES.includes(options.failOn)) {
        throw new Error(`--fail-on needs one of: ${REGIMES.join(', ')}.`);
    }
    if (options.samples < 1) {
        throw new Error('--samples needs at least 1.');
    }

    return options;
}

function readStandardInput() {
    return fs.readFileSync(0, 'utf8');
}

/**
 * @param {string[]} argv
 * @param {{stdout?: Function, stderr?: Function, lib?: Object}} io Output functions, and a library to use instead of the one of --lib
 * @returns {number} The exit code
 */
function main(argv, {stdout = (text) => process.stdout.write(text + '\n'), stderr = (text) => process.stderr.write(text + '\n'), lib = null} = {}) {
    let options;
    try {
        options = parseArguments(argv);
    } catch (error) {
        stderr(`${error.message}\nTry --help.`);

        return 2;
    }

    if (options.help) {
        const header = fs.readFileSync(__filename, 'utf8').split('*/')[0];
        stdout(header.replace(/^#!.*\n/, '').replace(/^\/\*\n?/, '').replace(/^ \* ?/gm, '').trimEnd());

        return 0;
    }

    let entries = [];
    try {
        for (const file of options.files) {
            entries = entries.concat(file === '-' ? parseExpressionList(readStandardInput(), 'stdin') : parseExpressionList(fs.readFileSync(file, 'utf8'), file));
        }
        for (const directory of options.extract) {
            entries = entries.concat(extractFromTree(directory));
        }
    } catch (error) {
        stderr(`Cannot read the expressions: ${error.message}`);

        return 2;
    }
    if (options.files.length === 0 && options.extract.length === 0) {
        stderr('Give a file of expressions, "-" for the standard input, or --extract <directory>. Try --help.');

        return 2;
    }

    // the same expression found in several places is audited once
    const merged = new Map();
    for (const entry of entries) {
        if (!merged.has(entry.expr)) {
            merged.set(entry.expr, {expr: entry.expr, sources: []});
        }
        merged.get(entry.expr).sources.push(...(entry.sources || []));
    }
    entries = [...merged.values()];

    let library = lib;
    if (library === null) {
        try {
            library = require(path.resolve(options.lib));
        } catch (error) {
            stderr(`Cannot load the library from ${options.lib} (${error.message.split('\n')[0]}). Run "npm run build", or point --lib to a build.`);

            return 2;
        }
    }

    let auditResult;
    try {
        auditResult = createAuditor(library, {samples: options.samples, seed: options.seed}).audit(entries);
    } catch (error) {
        stderr(error.message);

        return 2;
    }

    let phpCheck = null;
    if (options.phpSymfony !== null) {
        try {
            phpCheck = crossCheckWithPhp(auditResult.cases, {php: options.php, symfonyPath: options.phpSymfony});
        } catch (error) {
            stderr(error.message);

            return 2;
        }
    }

    stdout(formatReport(auditResult, {read: entries.length, limit: options.limit, phpCheck}));

    if (options.json !== null) {
        const report = {
            options: {samples: options.samples, seed: options.seed},
            results: auditResult.results,
            unparseable: auditResult.unparseable,
            phpCheck: phpCheck && {total: phpCheck.total, same: phpCheck.same, differences: phpCheck.differences},
        };
        fs.writeFileSync(options.json, JSON.stringify(report, null, 2));
        stdout(`Report written to ${options.json}`);
    }

    let exitCode = 0;
    if (options.failOn !== null) {
        const bad = auditResult.results.filter((result) => !result.trivial && result.regimes[options.failOn].notPortable > 0);
        if (bad.length > 0) {
            stderr(`${bad.length} expression(s) are not portable with ${options.failOn} values (--fail-on ${options.failOn}).`);
            exitCode = 1;
        }
    }
    if (phpCheck !== null && phpCheck.differences.length > 0) {
        stderr(`${phpCheck.differences.length} sample(s) give another result than Symfony's PHP.`);
        exitCode = 1;
    }

    return exitCode;
}

module.exports = {
    parseExpressionList,
    extractFromText,
    extractFromTree,
    createAuditor,
    crossCheckWithPhp,
    formatReport,
    describeCause,
    parseArguments,
    main,
};

if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
