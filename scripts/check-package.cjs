#!/usr/bin/env node
/*
 * Checks the package the way people receive it: packs it, looks at what is in the tarball, installs the tarball into a clean project,
 * and runs what it ships (the entry point, the browser bundle, and the command of the "bin" entry).
 *
 * The tests run on the sources and smoke-build.cjs on the built files; this is the only one that goes through `npm pack`, so it is the
 * one that notices a file that is no longer published (the `files` of package.json), a bin entry that points nowhere, or a command that cannot run.
 *
 * Run `npm run build:all` first. Needs the network: the dependencies of the package are installed from the registry.
 *
 *   node scripts/check-package.cjs
 */
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = require(path.join(root, 'package.json'));

const MUST_CONTAIN = [
    'package.json', 'README.md', 'CHANGELOG.md', 'UPGRADE-3.0.md', 'LICENSE.txt',
    'lib/index.js', 'dist/expression-language.js', 'dist/expression-language.min.js', 'dist/index.d.ts',
    // the PHP helper is run by the command, it has to travel with it
    'bin/portability-audit.cjs', 'bin/portability-audit.php',
];
// Nothing of the repository's tooling, and nothing a working copy leaves lying around (a coverage report, local settings of an editor):
// the `files` of package.json is an allowlist, and this is what proves it holds
const MUST_NOT_CONTAIN = [
    /^src\//, /^scripts\//, /^types\//, /^examples\//, /^\.github\//, /^node_modules\//, /^\.idea\//, /^\.claude\//, /^coverage\//,
    /__tests__/, /^rollup\.config/, /^jest-reporter/, /^tsconfig/, /^\.babelrc/, /^\.npmignore/, /^\.env/,
];

const failures = [];
const check = (ok, message) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${message}`);
    if (!ok) {
        failures.push(message);
    }

    return ok;
};
const run = (command, args, options = {}) => childProcess.spawnSync(command, args, {encoding: 'utf8', maxBuffer: 1 << 28, ...options});

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-package-'));
try {
    console.log('The tarball');
    const packed = run('npm', ['pack', '--json', '--pack-destination', directory], {cwd: root});
    if (!check(packed.status === 0, 'npm pack succeeds')) {
        console.log(packed.stderr);
        process.exit(1);
    }
    const [info] = JSON.parse(packed.stdout);
    const files = info.files.map((file) => file.path);
    const tarball = path.join(directory, info.filename);

    for (const file of MUST_CONTAIN) {
        check(files.includes(file), `contains ${file}`);
    }
    for (const pattern of MUST_NOT_CONTAIN) {
        check(!files.some((file) => pattern.test(file)), `contains nothing that matches ${pattern}`);
    }
    for (const [name, target] of Object.entries(manifest.bin || {})) {
        check(files.includes(target.replace(/^\.\//, '')), `the bin entry "${name}" points to a file of the tarball (${target})`);
    }

    console.log('\nInstalled into a clean project');
    const project = path.join(directory, 'project');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({name: 'check-package', version: '1.0.0', private: true}));
    const install = run('npm', ['install', tarball, '--no-audit', '--no-fund', '--ignore-scripts'], {cwd: project});
    if (!check(install.status === 0, 'npm install of the tarball succeeds')) {
        console.log(install.stderr);
        process.exit(1);
    }

    const node = (code) => run(process.execPath, ['-e', code], {cwd: project});
    const entry = node(`const l = require('${manifest.name}'); process.stdout.write(String(l.ExpressionLanguage && new l.ExpressionLanguage().evaluate('1 + 2')))`);
    check(entry.status === 0 && entry.stdout === '3', 'require() of the package works and evaluates an expression');

    const bundle = node(`const l = require('${manifest.name}/dist/expression-language.min.js'); process.stdout.write(String(new l.ExpressionLanguage().evaluate('1 + 2')))`);
    check(bundle.status === 0 && bundle.stdout === '3', 'the minified browser bundle works');

    check(fs.existsSync(path.join(project, 'node_modules', manifest.name, manifest.types)), `the types are there (${manifest.types})`);

    for (const name of Object.keys(manifest.bin || {})) {
        const executable = path.join(project, 'node_modules', '.bin', name);
        if (!check(fs.existsSync(executable), `the command ${name} is installed`)) {
            continue;
        }

        const list = path.join(project, 'rules.txt');
        fs.writeFileSync(list, 'price > 10\nobject.owner == user\n');

        const help = run(executable, ['--help'], {cwd: project});
        check(help.status === 0 && help.stdout.includes('Portability audit'), `${name} --help`);

        const audit = run(executable, [list, '--samples', '40'], {cwd: project});
        check(audit.status === 0 && /audited\s+: 2/.test(audit.stdout) && audit.stdout.includes('NOT PORTABLE with ordinary values: 1'), `${name} audits a list of expressions`);

        const failing = run(executable, [list, '--samples', '40', '--fail-on', 'ordinary'], {cwd: project});
        check(failing.status === 1, `${name} --fail-on exits with 1 when an expression is not portable`);

        const usage = run(executable, [], {cwd: project});
        check(usage.status === 2, `${name} without arguments is a usage error (exit code 2)`);
    }
} finally {
    fs.rmSync(directory, {recursive: true, force: true});
}

console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
