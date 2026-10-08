import fs from "fs";
import os from "os";
import path from "path";
import * as library from "../index";

const audit = require("../../scripts/portability-audit.cjs");

// the library under audit is the sources: no build needed
const auditor = (options = {}) => audit.createAuditor(library, {samples: 120, ...options});
const auditOne = (expression, options) => auditor(options).audit([{expr: expression}]);
const regimesOf = (expression) => auditOne(expression).results[0].regimes;
const notPortable = (expression, regime) => regimesOf(expression)[regime].notPortable > 0;

function temporaryDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'portability-audit-test-'));
}

describe('reading expressions', () => {
    test('a JSON array of strings or of objects', () => {
        expect(audit.parseExpressionList('["a + b", "c == d"]', 'x.json').map((e) => e.expr)).toEqual(['a + b', 'c == d']);
        expect(audit.parseExpressionList('[{"expr": "a + b", "sources": [{"file": "f"}]}, {"expression": "c"}]', 'x.json')).toEqual([
            {expr: 'a + b', sources: [{file: 'f'}]},
            {expr: 'c', sources: [{file: 'x.json', ctx: 'list'}]},
        ]);
        expect(audit.parseExpressionList('{"expressions": ["a"]}', 'x.json')).toHaveLength(1);
    });

    test('a text file: one expression per line, comments and blank lines ignored', () => {
        const list = audit.parseExpressionList('# the rules\n\na + b\n   c == d   \n\n# end\n', 'rules.txt');

        expect(list.map((e) => e.expr)).toEqual(['a + b', 'c == d']);
        expect(list[0].sources).toEqual([{file: 'rules.txt', ctx: 'list'}]);
    });

    test('a malformed JSON list is refused', () => {
        expect(() => audit.parseExpressionList('[1, 2]', 'x.json')).toThrow('has no "expr"');
        expect(() => audit.parseExpressionList('{"nope": 1}', 'x.json')).toThrow('expected a JSON array');
        expect(() => audit.parseExpressionList('[unfinished', 'x.json')).toThrow();
    });
});

describe('extracting expressions from source code', () => {
    const extract = (text, file = 'f') => {
        const found = new Map();
        audit.extractFromText(text, file, found);

        return [...found.keys()];
    };

    test.each([
        ["a PHP attribute", `#[IsGranted(expression: 'is_granted("ROLE_ADMIN") and subject.owner == user')]`, ['is_granted("ROLE_ADMIN") and subject.owner == user']],
        ["an API Platform operation", `new Get(security: "is_granted('ROLE_USER') and object.owner == user")`, ["is_granted('ROLE_USER') and object.owner == user"]],
        ["an array option", `['security' => 'object.price > 10']`, ['object.price > 10']],
        ["an annotation", `@Security("is_granted('ROLE_ADMIN') or user.age >= 18")`, ["is_granted('ROLE_ADMIN') or user.age >= 18"]],
        ["new Expression", `$c = new Expression('this.getAmount() > 100');`, ['this.getAmount() > 100']],
        ["a constraint", `#[Assert\\Expression("this.getCategory() in ['php', 'symfony']")]`, ["this.getCategory() in ['php', 'symfony']"]],
        ["a route condition", `condition: "request.headers.get('User-Agent') matches '/firefox/i'"`, ["request.headers.get('User-Agent') matches '/firefox/i'"]],
        ["a workflow guard", `guard: is_granted('ROLE_REVIEWER') and subject.isRejectable()`, ["is_granted('ROLE_REVIEWER') and subject.isRejectable()"]],
        ["a service expression", `arguments: ['@=service("config").getDirectory()']`, ['service("config").getDirectory()']],
        ["a service expression function", `->args([expression('parameter("kernel.debug") ? 1 : 2')])`, ['parameter("kernel.debug") ? 1 : 2']],
        ["an XML attribute", `<route condition="context.getMethod() in ['GET', 'HEAD']" />`, ["context.getMethod() in ['GET', 'HEAD']"]],
        ["an XML element", `<framework:guard>is_granted("ROLE_ADMIN")</framework:guard>`, ['is_granted("ROLE_ADMIN")']],
        ["XML entities", `<route condition="request.method == &quot;GET&quot; and a &lt; 3" />`, ['request.method == "GET" and a < 3']],
        ["a JavaScript call", `const ok = el.evaluate('price * quantity > 100', values);`, ['price * quantity > 100']],
        ["an escaped quote", `security: 'object.name == \\'it\\''`, ["object.name == 'it'"]],
    ])('%s', (name, source, expected) => {
        expect(extract(source)).toEqual(expect.arrayContaining(expected));
    });

    test('plain code and prose are not expressions', () => {
        expect(extract(`$x = 1 + 2;\nfunction evaluate(a) { return a; }\n// the condition is simple\nconst s = 'security';`)).toEqual([]);
    });

    test('a multi-line string and an absurdly long one are skipped', () => {
        expect(extract(`security: "a\nb"`)).toEqual([]);
        expect(extract(`security: '${'a + '.repeat(200)}1'`)).toEqual([]);
    });

    test('remembers where an expression was found, and how', () => {
        const found = new Map();
        audit.extractFromText(`security: 'a == b'`, 'one.yaml', found);
        audit.extractFromText(`new Expression('a == b')`, 'two.php', found);

        expect(found.get('a == b')).toEqual([{file: 'one.yaml', ctx: 'key'}, {file: 'two.php', ctx: 'call'}, ]);
    });

    test('walks a tree, skipping vendor code and unknown file types, and merges what is found twice', () => {
        const root = temporaryDirectory();
        try {
            fs.mkdirSync(path.join(root, 'src/Controller'), {recursive: true});
            fs.mkdirSync(path.join(root, 'vendor/acme'), {recursive: true});
            fs.mkdirSync(path.join(root, 'node_modules/acme'), {recursive: true});
            fs.writeFileSync(path.join(root, 'src/Controller/A.php'), `#[IsGranted(expression: 'a == b')]`);
            fs.writeFileSync(path.join(root, 'src/routes.yaml'), `condition: "a == b"\nother:\n  security: "c > 1"\n`);
            fs.writeFileSync(path.join(root, 'src/binary.png'), `security: 'never'`);
            fs.writeFileSync(path.join(root, 'vendor/acme/V.php'), `new Expression('from vendor')`);
            fs.writeFileSync(path.join(root, 'node_modules/acme/i.js'), `el.evaluate('from node_modules')`);

            const found = audit.extractFromTree(root);

            expect(found.map((e) => e.expr).sort()).toEqual(['a == b', 'c > 1']);
            expect(found.find((e) => e.expr === 'a == b').sources.map((s) => s.file).sort()).toEqual([path.join('src', 'Controller', 'A.php'), path.join('src', 'routes.yaml')]);
        } finally {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });
});

describe('auditing', () => {
    test('what is not an expression, or has nothing to be sensitive about, is set aside', () => {
        const {results, unparseable} = auditor().audit([{expr: "is_granted('ROLE_ADMIN')"}, {expr: 'user'}, {expr: '$foo'}, {expr: '1 +'}, {expr: 'a == b'}]);

        expect(results.filter((r) => r.trivial).map((r) => r.expr)).toEqual(["is_granted('ROLE_ADMIN')", 'user']);
        expect(unparseable.map((u) => u.expr)).toEqual(['$foo', '1 +']);
        expect(unparseable[0].reason).toContain('Unexpected character');
        expect(results.filter((r) => !r.trivial).map((r) => r.expr)).toEqual(['a == b']);
    });

    test('unknown functions and variables are fine: they are leaves', () => {
        expect(auditOne("is_granted('X') and service('y').count > 3").results[0].trivial).toBe(false);
    });

    test.each([
        // expression, [portable with ordinary values, with edge values, with wrong-typed values]
        ['price > 100', [true, true, false]],
        ['price * quantity >= 10', [true, true, false]],
        ["status == 'draft'", [true, true, false]],
        ["role in ['ROLE_A', 'ROLE_B']", [true, true, true]],
        ["name starts with 'A' and name ~ '!' != ''", [true, true, false]],
        ['isActive ? 1 : 2', [true, true, false]],
        ['a + b', [true, true, false]],
        ['count(items) > 0', [true, true, false]],
        ['x ?? 5', [true, true, true]],
    ])('%s', (expression, [ordinary, edge, mixed]) => {
        expect([!notPortable(expression, 'ordinary'), !notPortable(expression, 'edge'), !notPortable(expression, 'mixed')]).toEqual([ordinary, edge, mixed]);
    });

    test('an ownership check is not portable, because two objects with equal contents are not the same instance in JavaScript', () => {
        const regimes = regimesOf('object.getOwner() == user');

        expect(regimes.ordinary.notPortable).toBeGreaterThan(0);
        expect(regimes.ordinary.byOperator).toEqual({'==': regimes.ordinary.notPortable});
        expect(audit.describeCause(regimes.ordinary.example.message)).toBe('== on two objects with equal contents (distinct instances)');
        // ...which is what the default semantics of 3.0 change in the result, compared with 2.x
        expect(regimes.ordinary.resultChanges).toBeGreaterThan(0);
        expect(regimes.ordinary.changeExample.symfony).toBe(true);
        expect(regimes.ordinary.changeExample.js).toBe(false);
    });

    test('truthiness of a value that is not a boolean is only a problem for edge values', () => {
        expect(notPortable('user and user.active', 'ordinary')).toBe(false);
        expect(notPortable('name or alias', 'edge')).toBe(true);
        expect(audit.describeCause(regimesOf('name or alias').edge.example.message)).toBe('boolean test');
    });

    test('a number held as a string is a problem when ordering or adding', () => {
        const regimes = regimesOf('a + b > c');

        expect(regimes.mixed.notPortable).toBeGreaterThan(0);
        expect(Object.keys(regimes.mixed.byOperator).sort()).toEqual(expect.arrayContaining(['+']));
    });

    test('the leaves are described', () => {
        expect(auditOne("is_granted('X') and object.owner == user").results[0].leaves.map((leaf) => leaf.text)).toEqual(["is_granted(\"X\")", 'object.owner', 'user']);
    });

    test('the same seed gives the same report, another seed another sample', () => {
        const run = (seed) => JSON.stringify(auditOne('object.owner == user and a > b', {seed}).results);

        expect(run(1)).toBe(run(1));
        expect(run(1)).not.toBe(run(2));
    });

    test('it keeps what Symfony\'s PHP is asked to evaluate: the rewritten expression with its values and this library\'s answer', () => {
        const {cases} = auditOne('a + b > c', {phpSamples: 5});

        expect(cases).toHaveLength(15);
        expect(new Set(cases.map((c) => c.regime))).toEqual(new Set(['ordinary', 'edge', 'mixed']));
        expect(cases[0].text).toBe('((__L0 + __L1) > __L2)');
        expect(Object.keys(cases[0].values)).toEqual(['__L0', '__L1', '__L2']);
        expect('value' in cases[0].ours || 'error' in cases[0].ours).toBe(true);
    });

    test('it refuses a library that is not 3.0', () => {
        expect(() => audit.createAuditor({Parser: library.Parser, tokenize: library.tokenize}, {})).toThrow('is not expression-language 3.0 or later: "IGNORE_UNKNOWN_VARIABLES" is missing.');
    });
});

describe('the report', () => {
    const report = (expressions, options = {}) => {
        const result = auditor().audit(expressions.map((expr) => ({expr})));

        return audit.formatReport(result, {read: expressions.length, ...options});
    };

    test('counts, shares and causes', () => {
        const text = report(['object.owner == user', 'price > 10', 'is_granted("X")', '$nope']);

        expect(text).toContain('expressions read             : 4');
        expect(text).toContain('not parseable              : 1');
        expect(text).toContain('trivial (nothing to audit) : 1');
        expect(text).toContain('audited                    : 2');
        expect(text).toMatch(/ordinary\s+50\.0%\s+portable \(1\/2\)/);
        expect(text).toMatch(/mixed\s+0\.0%\s+portable \(0\/2\)/);
        expect(text).toContain('NOT PORTABLE with ordinary values: 1');
        expect(text).toContain('== on two objects with equal contents (distinct instances)');
        expect(text).toContain('object.owner == user');
        expect(text).toContain('Not parseable (1)');
        expect(text).toContain('$nope');
    });

    test('says so when there is nothing to audit', () => {
        expect(report(['user', '$nope'])).toContain('Nothing to audit.');
    });

    test('lists as many expressions as the limit allows', () => {
        const many = Array.from({length: 6}, (_, i) => `object${i}.owner == user`);

        expect(report(many, {limit: 2})).toContain('... and 4 more');
        expect(report(many, {limit: 0})).not.toContain('... and');
        expect((report(many, {limit: 0}).match(/object\d\.owner == user\n/g) || []).length).toBeGreaterThanOrEqual(6);
    });

    test('a comparison with PHP is shown', () => {
        const phpCheck = {total: 10, same: 9, differences: [{expr: 'a == b', regime: 'mixed', values: {__L0: 1}, ours: {value: true}, php: {value: false}}]};
        const text = report(['a == b'], {phpCheck});

        expect(text).toContain('9/10 identical, 1 different');
        expect(text).toContain('this library: {"value":true}');
        expect(text).toContain('PHP         : {"value":false}');
    });
});

describe('the command line', () => {
    const run = (args, extra = {}) => {
        const out = [];
        const err = [];
        const code = audit.main(args, {stdout: (text) => out.push(text), stderr: (text) => err.push(text), lib: library, ...extra});

        return {code, out: out.join('\n'), err: err.join('\n')};
    };
    const withFile = (content, callback, name = 'list.txt') => {
        const directory = temporaryDirectory();
        try {
            const file = path.join(directory, name);
            fs.writeFileSync(file, content);

            return callback(file, directory);
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    };

    test('audits a file', () => {
        withFile('price > 10\nobject.owner == user\n', (file) => {
            const {code, out} = run([file, '--samples', '50']);

            expect(code).toBe(0);
            expect(out).toContain('audited                    : 2');
        });
    });

    test('extracts from a directory, and merges what is found twice', () => {
        withFile(`security: 'a > 1'\n`, (file, directory) => {
            fs.writeFileSync(path.join(directory, 'b.yaml'), `condition: "a > 1"\n`);
            const {code, out} = run(['--extract', directory, file, '--samples', '20']);

            expect(code).toBe(0);
            // list.txt holds the text itself (no expression), b.yaml a > 1; the same expression is audited once
            expect(out).toMatch(/expressions read\s+: \d+/);
            expect(out).toContain('audited                    : 1');
        }, 'list.txt');
    });

    test('--fail-on turns a finding into an exit code', () => {
        withFile('object.owner == user\n', (file) => {
            expect(run([file, '--samples', '60', '--fail-on', 'ordinary']).code).toBe(1);
            expect(run([file, '--samples', '60', '--fail-on', 'ordinary']).err).toContain('1 expression(s) are not portable with ordinary values');
        });
        withFile('price > 10\n', (file) => {
            expect(run([file, '--samples', '60', '--fail-on', 'ordinary']).code).toBe(0);
            expect(run([file, '--samples', '60', '--fail-on', 'edge']).code).toBe(0);
            expect(run([file, '--samples', '60', '--fail-on', 'mixed']).code).toBe(1);
        });
        withFile('price > 10\n', (file) => expect(run([file, '--samples', '60']).code).toBe(0));
    });

    test('--json writes the whole report', () => {
        withFile('object.owner == user\n$nope\n', (file, directory) => {
            const json = path.join(directory, 'report.json');
            const {out} = run([file, '--samples', '30', '--json', json]);
            const written = JSON.parse(fs.readFileSync(json, 'utf8'));

            expect(out).toContain(`Report written to ${json}`);
            expect(written.options).toEqual({samples: 30, seed: 20261008});
            expect(written.results).toHaveLength(1);
            expect(written.results[0].regimes.ordinary.example.message).toContain('is not portable');
            expect(written.unparseable[0].expr).toBe('$nope');
        });
    });

    test('--help shows the usage', () => {
        const {code, out} = run(['--help']);

        expect(code).toBe(0);
        expect(out).toContain('Portability audit: do your expressions mean the same thing in PHP (Symfony) and in JavaScript?');
        expect(out).toContain('--extract <dir>');
        expect(out).not.toContain("'use strict'");
    });

    test.each([
        [[], 'Give a file of expressions'],
        [['--nope'], 'Unknown option --nope'],
        [['x.txt', '--samples'], '--samples needs a value'],
        [['x.txt', '--samples', 'many'], '--samples needs a whole number'],
        [['x.txt', '--samples', '0'], '--samples needs at least 1'],
        [['x.txt', '--fail-on', 'always'], '--fail-on needs one of: ordinary, edge, mixed'],
        [['/does/not/exist.txt'], 'Cannot read the expressions'],
    ])('wrong usage %j is exit code 2', (args, message) => {
        const {code, err} = run(args);

        expect(code).toBe(2);
        expect(err).toContain(message);
    });

    test('a library that cannot be loaded is exit code 2', () => {
        withFile('a > 1\n', (file) => {
            const {code, err} = run([file, '--lib', '/does/not/exist'], {lib: null});

            expect(code).toBe(2);
            expect(err).toContain('Cannot load the library from /does/not/exist');
        });
    });

    test('argument parsing', () => {
        expect(audit.parseArguments(['a.txt', '--extract', 'src', '--extract', 'app', '--limit', '0', '--seed', '7', '--php', '/usr/bin/php8'])).toMatchObject({
            files: ['a.txt'], extract: ['src', 'app'], limit: 0, seed: 7, php: '/usr/bin/php8', samples: 300,
        });
    });
});

// The comparison with Symfony's own PHP needs php and a checkout of the component: opt in with
//
//   SYMFONY_EXPRESSION_LANGUAGE_PATH=/path/to/checkout npm test -- PortabilityAudit
const symfonyPath = process.env.SYMFONY_EXPRESSION_LANGUAGE_PATH;
const phpTest = symfonyPath ? test : test.skip;

describe('the comparison with Symfony\'s PHP', () => {
    phpTest('the default semantics give the answers of Symfony for typical, edge and wrongly-typed values', () => {
        const expressions = [
            'object.getOwner() == user', "is_granted('ROLE_USER') and price > 10", 'a + b > c', "name starts with 'A' or name ~ '!' == ''",
            'x ?? 5', 'list[0] in [1, 2, 3]', "status == 'draft' ? total * 2 : total / 2", 'not (a and b) or c', 'a ? b : c', 'a <=> b',
        ];
        const {cases} = auditor({phpSamples: 40}).audit(expressions.map((expr) => ({expr})));
        const check = audit.crossCheckWithPhp(cases, {php: process.env.PHP_BIN || 'php', symfonyPath});

        expect(check.total).toBeGreaterThan(500);
        expect(check.differences).toEqual([]);
        expect(check.same).toBe(check.total);
    });

    phpTest('a difference is reported', () => {
        const cases = [{expr: 'a', regime: 'ordinary', text: '(1 + 1)', values: {}, ours: {value: 3}}];
        const check = audit.crossCheckWithPhp(cases, {php: process.env.PHP_BIN || 'php', symfonyPath});

        expect(check.differences).toHaveLength(1);
        expect(check.differences[0].php).toEqual({value: 2});
    });

    phpTest('a php that cannot run is an error', () => {
        expect(() => audit.crossCheckWithPhp([{text: '1', values: {}, ours: {value: 1}}], {php: '/does/not/exist', symfonyPath})).toThrow('php failed');
    });
});
