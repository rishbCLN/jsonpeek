import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, HELP } from '../src/args.mjs';

test('parseArgs: defaults with no args', () => {
  const r = parseArgs([]);
  assert.equal(r.file, null);
  assert.equal(r.path, null);
  assert.equal(r.find, null);
  assert.equal(r.listPaths, false);
  assert.equal(r.jq, false);
  assert.equal(r.depth, null);
  assert.equal(r.compact, false);
  assert.equal(r.color, undefined);
  assert.equal(r.help, false);
  assert.equal(r.version, false);
  assert.deepEqual(r.errors, []);
});

test('parseArgs: file positional vs stdin (no file)', () => {
  assert.equal(parseArgs(['data.json']).file, 'data.json');
  assert.equal(parseArgs([]).file, null);
});

test('parseArgs: --path in space and = forms', () => {
  assert.equal(parseArgs(['--path', '.a.b']).path, '.a.b');
  assert.equal(parseArgs(['--path=.a.b']).path, '.a.b');
});

test('parseArgs: --find and --jq and --paths', () => {
  const r = parseArgs(['--find', 'id', '--jq']);
  assert.equal(r.find, 'id');
  assert.equal(r.jq, true);
  assert.equal(parseArgs(['--paths']).listPaths, true);
});

test('parseArgs: --depth valid and invalid', () => {
  assert.equal(parseArgs(['--depth', '2']).depth, 2);
  assert.equal(parseArgs(['--depth=0']).depth, 0);
  assert.ok(parseArgs(['--depth', '-1']).errors.length);
  assert.ok(parseArgs(['--depth', 'x']).errors.length);
});

test('parseArgs: --compact / -c', () => {
  assert.equal(parseArgs(['--compact']).compact, true);
  assert.equal(parseArgs(['-c']).compact, true);
});

test('parseArgs: --color / --no-color', () => {
  assert.equal(parseArgs(['--color']).color, 'always');
  assert.equal(parseArgs(['--no-color']).color, 'never');
});

test('parseArgs: help and version, short and long', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
  assert.equal(parseArgs(['--version']).version, true);
});

test('parseArgs: unknown option is collected as an error', () => {
  assert.ok(parseArgs(['--bogus']).errors.some((e) => /unknown option/.test(e)));
});

test('parseArgs: missing option value is an error', () => {
  assert.ok(parseArgs(['--path']).errors.some((e) => /--path requires a value/.test(e)));
  assert.ok(parseArgs(['--find']).errors.some((e) => /--find requires a value/.test(e)));
});

test('parseArgs: a second positional is an error', () => {
  const r = parseArgs(['a.json', 'b.json']);
  assert.equal(r.file, 'a.json');
  assert.ok(r.errors.some((e) => /extra argument/.test(e)));
});

test('parseArgs: a realistic mix', () => {
  const r = parseArgs(['data.json', '--path', 'a.b[0]', '--no-color', '--compact']);
  assert.equal(r.file, 'data.json');
  assert.equal(r.path, 'a.b[0]');
  assert.equal(r.color, 'never');
  assert.equal(r.compact, true);
  assert.deepEqual(r.errors, []);
});

test('HELP text documents the core options', () => {
  assert.match(HELP, /--path/);
  assert.match(HELP, /--find/);
  assert.match(HELP, /--no-color/);
  assert.match(HELP, /stdin/);
});
