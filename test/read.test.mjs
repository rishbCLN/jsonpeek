import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readStream, readInput } from '../src/read.mjs';
import { parseJson } from '../src/parse.mjs';

test('readStream collects a piped string (chunked)', async () => {
  const stream = Readable.from(['{"a":', '1}']);
  const text = await readStream(stream);
  assert.equal(text, '{"a":1}');
  assert.deepEqual(parseJson(text), { a: 1 });
});

test('readInput reads a file via the injected reader', async () => {
  const { source, origin } = await readInput({
    file: 'data.json',
    readFile: (p) => {
      assert.equal(p, 'data.json');
      return '{"ok":true}';
    },
  });
  assert.equal(source, '{"ok":true}');
  assert.equal(origin, 'data.json');
  assert.deepEqual(parseJson(source), { ok: true });
});

test('readInput reads stdin when not a TTY (injected stream)', async () => {
  const stdin = Readable.from(['[1,2,3]']);
  const { source, origin } = await readInput({ stdin, isTTY: false });
  assert.equal(origin, 'stdin');
  assert.deepEqual(parseJson(source), [1, 2, 3]);
});

test('readInput returns null source for an interactive TTY with no file', async () => {
  const stdin = Readable.from([]); // must NOT be consumed / must not hang
  const { source, origin } = await readInput({ stdin, isTTY: true });
  assert.equal(source, null);
  assert.equal(origin, 'tty');
});
