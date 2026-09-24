import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStyler, colorEnabled, stripAnsi } from '../src/ui.mjs';

test('makeStyler(false) is a passthrough', () => {
  const c = makeStyler(false);
  assert.equal(c.enabled, false);
  assert.equal(c.key('x'), 'x');
  assert.equal(c.string('y'), 'y');
  assert.equal(c.punctuation('{'), '{');
});

test('makeStyler(true) wraps in ANSI; stripAnsi reverses it', () => {
  const c = makeStyler(true);
  const painted = c.number('42');
  assert.notEqual(painted, '42');
  assert.ok(painted.includes('\x1b['));
  assert.equal(stripAnsi(painted), '42');
});

test('colorEnabled: explicit override always wins', () => {
  assert.equal(colorEnabled({ NO_COLOR: '1' }, { isTTY: false }, 'always'), true);
  assert.equal(colorEnabled({ FORCE_COLOR: '1' }, { isTTY: true }, 'never'), false);
});

test('colorEnabled: NO_COLOR disables even on a TTY', () => {
  assert.equal(colorEnabled({ NO_COLOR: '1' }, { isTTY: true }), false);
});

test('colorEnabled: FORCE_COLOR enables without a TTY', () => {
  assert.equal(colorEnabled({ FORCE_COLOR: '1' }, { isTTY: false }), true);
});

test('colorEnabled: otherwise follows stdout.isTTY', () => {
  assert.equal(colorEnabled({}, { isTTY: true }), true);
  assert.equal(colorEnabled({}, { isTTY: false }), false);
});

test('stripAnsi removes SGR sequences and leaves plain text intact', () => {
  assert.equal(stripAnsi('\x1b[32mhi\x1b[39m'), 'hi');
  assert.equal(stripAnsi('plain'), 'plain');
});
