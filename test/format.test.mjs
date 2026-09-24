import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format, identityStyler, MAX_DEPTH } from '../src/format.mjs';
import { makeStyler, stripAnsi } from '../src/ui.mjs';

const doc = {
  name: 'jsonpeek',
  count: 3,
  ok: true,
  missing: null,
  nested: { list: [1, 2, 3], flag: false },
  empty: {},
  arr: [],
};

test('pretty output equals JSON.stringify(…, null, 2) with color off', () => {
  assert.equal(format(doc), JSON.stringify(doc, null, 2));
});

test('exact snapshot for a nested document (color off)', () => {
  const expected = [
    '{',
    '  "name": "jsonpeek",',
    '  "count": 3,',
    '  "ok": true,',
    '  "missing": null,',
    '  "nested": {',
    '    "list": [',
    '      1,',
    '      2,',
    '      3',
    '    ],',
    '    "flag": false',
    '  },',
    '  "empty": {},',
    '  "arr": []',
    '}',
  ].join('\n');
  assert.equal(format(doc), expected);
});

test('all scalar types render like JSON', () => {
  assert.equal(format(42), '42');
  assert.equal(format(-1.5), '-1.5');
  assert.equal(format('hi "there"'), '"hi \\"there\\""');
  assert.equal(format(true), 'true');
  assert.equal(format(false), 'false');
  assert.equal(format(null), 'null');
});

test('non-finite numbers degrade to null (as JSON has no NaN/Infinity)', () => {
  assert.equal(format(NaN), 'null');
  assert.equal(format(Infinity), 'null');
});

test('compact mode equals JSON.stringify with no spacing', () => {
  assert.equal(format(doc, { compact: true }), JSON.stringify(doc));
});

test('formatted output round-trips back to the original value', () => {
  assert.deepEqual(JSON.parse(format(doc)), doc);
  assert.deepEqual(JSON.parse(format(doc, { compact: true })), doc);
});

test('--depth collapses containers deeper than n', () => {
  assert.equal(format({ a: { b: { c: 1 } } }, { depth: 1 }), '{\n  "a": {\u2026}\n}');
  assert.equal(
    format({ a: { b: { c: 1 } } }, { depth: 2 }),
    '{\n  "a": {\n    "b": {\u2026}\n  }\n}',
  );
});

test('maxArray truncates long arrays with a "(N more)" marker', () => {
  assert.equal(
    format([1, 2, 3, 4, 5], { maxArray: 2 }),
    '[\n  1,\n  2,\n  \u2026 (3 more)\n]',
  );
});

test('identityStyler is a no-op set of token functions', () => {
  const s = identityStyler();
  assert.equal(s.key('x'), 'x');
  assert.equal(s.punctuation('{'), '{');
});

test('an injected styler colors tokens; stripping ANSI restores plain output', () => {
  const painted = format(doc, { styler: makeStyler(true) });
  assert.ok(painted.includes('\x1b['));
  assert.equal(stripAnsi(painted), format(doc));
});

test('depth guard throws instead of overflowing the stack', () => {
  let v = 0;
  for (let i = 0; i < MAX_DEPTH + 5; i++) v = [v];
  assert.throws(() => format(v), /deeper than the supported limit/);
});
