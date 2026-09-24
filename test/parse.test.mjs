import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJson,
  JsonParseError,
  locate,
  extractOffset,
  cleanReason,
  caretSnippet,
  formatParseError,
} from '../src/parse.mjs';

test('parseJson returns the parsed value for valid JSON', () => {
  assert.deepEqual(parseJson('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] });
  assert.equal(parseJson('42'), 42);
  assert.equal(parseJson('"hi"'), 'hi');
  assert.deepEqual(parseJson('[true,false,null]'), [true, false, null]);
});

test('parseJson strips a leading UTF-8 BOM', () => {
  assert.deepEqual(parseJson('\uFEFF{"a":1}'), { a: 1 });
});

test('invalid JSON throws a JsonParseError, never a raw SyntaxError', () => {
  assert.throws(
    () => parseJson('{"a": }'),
    (err) => {
      assert.equal(err.name, 'JsonParseError');
      assert.ok(err instanceof JsonParseError);
      assert.match(err.message, /^invalid JSON:/);
      return true;
    },
  );
});

test('unexpected end of input reports line, column and a caret snippet', () => {
  assert.throws(
    () => parseJson('{"a":1'),
    (err) => {
      assert.match(err.message, /line \d+, column \d+/);
      assert.equal(err.line, 1);
      assert.ok(err.column >= 1);
      assert.equal(typeof err.snippet, 'string');
      assert.ok(err.snippet.includes('^'));
      return true;
    },
  );
});

test('multi-line input locates the error past the first line', () => {
  const bad = '{\n  "a": 1,\n  "b": 2\n';
  assert.throws(
    () => parseJson(bad),
    (err) => {
      assert.ok(err.line >= 2, `expected line >= 2, got ${err.line}`);
      assert.match(err.message, /line \d+, column \d+/);
      return true;
    },
  );
});

test('locate maps character offsets to 1-based line/column', () => {
  assert.deepEqual(locate('abc\ndef', 0), { line: 1, column: 1 });
  assert.deepEqual(locate('abc\ndef', 5), { line: 2, column: 2 });
  assert.deepEqual(locate('', 10), { line: 1, column: 1 });
});

test('extractOffset reads "position N" or falls back to EOF', () => {
  assert.equal(extractOffset('Unexpected token } in JSON at position 5', 'xxxxxxx'), 5);
  assert.equal(extractOffset('Unexpected end of JSON input', 'abc'), 3);
  assert.equal(extractOffset('Unexpected token x, "ab" is not valid JSON', 'abcdef'), null);
});

test('cleanReason strips version-specific chatter', () => {
  assert.equal(cleanReason('Unexpected token } in JSON at position 5'), 'Unexpected token }');
  assert.equal(cleanReason('Unexpected token x, "abc" is not valid JSON'), 'Unexpected token x');
  assert.match(cleanReason('Unexpected end of JSON input'), /unexpected end of input/);
});

test('caretSnippet produces a two-line gutter + caret', () => {
  const snip = caretSnippet('  "a": 1', 1, 3);
  const lines = snip.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('^'));
});

test('formatParseError is plain with no styler and contains the location', () => {
  try {
    parseJson('{"a":1');
  } catch (err) {
    const out = formatParseError(err);
    assert.match(out, /error:/);
    assert.match(out, /line \d+, column \d+/);
    assert.ok(out.includes('^'));
  }
});
