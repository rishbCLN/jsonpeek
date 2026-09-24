import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIdentifier,
  toJqPath,
  toJsPath,
  leafPaths,
  listPaths,
  findKey,
  parsePath,
  getByPath,
} from '../src/paths.mjs';

const doc = {
  user: { id: 42, name: 'Ada' },
  items: [{ id: 1 }, { id: 2 }],
  'weird key': true,
  nested: { 'a-b': [10, 20] },
};

test('isIdentifier recognises bare JS identifiers only', () => {
  assert.equal(isIdentifier('foo'), true);
  assert.equal(isIdentifier('_x$'), true);
  assert.equal(isIdentifier('a-b'), false);
  assert.equal(isIdentifier('0a'), false);
  assert.equal(isIdentifier('weird key'), false);
});

test('toJqPath / toJsPath render segment lists, quoting odd keys', () => {
  const segs = [{ key: 'nested' }, { key: 'a-b' }, { index: 0 }];
  assert.equal(toJqPath(segs), '.nested["a-b"][0]');
  assert.equal(toJsPath(segs), 'nested["a-b"][0]');
  assert.equal(toJqPath([]), '.');
  assert.equal(toJsPath([]), '');
  assert.equal(toJqPath([{ index: 0 }]), '.[0]');
  assert.equal(toJsPath([{ index: 0 }]), '[0]');
  assert.equal(toJqPath([{ key: 'weird key' }]), '.["weird key"]');
});

test('listPaths enumerates every leaf in JS form', () => {
  assert.deepEqual(listPaths(doc), [
    'user.id',
    'user.name',
    'items[0].id',
    'items[1].id',
    '["weird key"]',
    'nested["a-b"][0]',
    'nested["a-b"][1]',
  ]);
});

test('listPaths enumerates every leaf in jq form', () => {
  assert.deepEqual(listPaths(doc, { jq: true }), [
    '.user.id',
    '.user.name',
    '.items[0].id',
    '.items[1].id',
    '.["weird key"]',
    '.nested["a-b"][0]',
    '.nested["a-b"][1]',
  ]);
});

test('leafPaths treats empty containers as leaves', () => {
  const leaves = leafPaths({ a: {}, b: [], c: 1 });
  assert.deepEqual(
    leaves.map((l) => l.segments),
    [[{ key: 'a' }], [{ key: 'b' }], [{ key: 'c' }]],
  );
});

test('findKey returns every matching path in document order (JS form)', () => {
  assert.deepEqual(findKey(doc, 'id').map(toJsPath), ['user.id', 'items[0].id', 'items[1].id']);
  const dup = { a: { id: 1, b: { id: 2 } }, id: 3 };
  assert.deepEqual(findKey(dup, 'id').map(toJsPath), ['a.id', 'a.b.id', 'id']);
  assert.deepEqual(findKey(doc, 'nope'), []);
});

test('findKey can render jq form', () => {
  assert.deepEqual(findKey(doc, 'id').map(toJqPath), ['.user.id', '.items[0].id', '.items[1].id']);
});

test('parsePath understands jq and JS forms', () => {
  assert.deepEqual(parsePath('a.b[0].c'), [
    { key: 'a' },
    { key: 'b' },
    { index: 0 },
    { key: 'c' },
  ]);
  assert.deepEqual(parsePath('.a.b'), [{ key: 'a' }, { key: 'b' }]);
  assert.deepEqual(parsePath('["weird key"].x'), [{ key: 'weird key' }, { key: 'x' }]);
  assert.deepEqual(parsePath("['single']"), [{ key: 'single' }]);
  assert.deepEqual(parsePath('items[-1]'), [{ key: 'items' }, { index: -1 }]);
  assert.deepEqual(parsePath('.'), []);
});

test('getByPath resolves values and returns undefined for misses', () => {
  assert.equal(getByPath(doc, 'user.id'), 42);
  assert.equal(getByPath(doc, '.user.name'), 'Ada');
  assert.equal(getByPath(doc, 'items[1].id'), 2);
  assert.equal(getByPath(doc, '["weird key"]'), true);
  assert.equal(getByPath(doc, 'nested["a-b"][1]'), 20);
  assert.equal(getByPath(doc, 'items[-1].id'), 2);
  assert.deepEqual(getByPath(doc, '.'), doc);
  assert.equal(getByPath(doc, 'user.missing'), undefined);
  assert.equal(getByPath(doc, 'items[5]'), undefined);
  assert.equal(getByPath(doc, 'user.id.deep'), undefined);
});

test('getByPath accepts pre-parsed segments', () => {
  assert.equal(getByPath(doc, parsePath('user.name')), 'Ada');
});

// Regression: the tree walkers must scale ~linearly with depth. They once copied
// the whole path prefix at every node (`[...segs, seg]`), which is O(depth^2) in
// time and allocations; a ~200k-deep document would hang for minutes or exhaust
// the heap. With parent-linked reconstruction this finishes in milliseconds.
test('deeply nested input is walked without O(n^2) blow-up', { timeout: 20000 }, () => {
  const DEPTH = 200000;

  // Built iteratively (no recursion, no JSON.parse) so the test itself is safe.
  let deepObj = 0;
  for (let i = 0; i < DEPTH; i++) deepObj = { a: deepObj };
  let deepArr = 0;
  for (let i = 0; i < DEPTH; i++) deepArr = [deepArr];

  const objLeaves = leafPaths(deepObj);
  assert.equal(objLeaves.length, 1);
  assert.equal(objLeaves[0].segments.length, DEPTH);
  assert.equal(objLeaves[0].value, 0);

  const arrLeaves = leafPaths(deepArr);
  assert.equal(arrLeaves.length, 1);
  assert.equal(arrLeaves[0].segments.length, DEPTH);

  // findKey visits every node; a miss returns [] (exercises the full traversal).
  assert.deepEqual(findKey(deepObj, 'missing'), []);

  // getByPath resolves a full-depth accessor.
  const segs = Array.from({ length: DEPTH }, () => ({ key: 'a' }));
  assert.equal(getByPath(deepObj, segs), 0);
});

test('findKey still matches a key repeated at every level (order preserved)', () => {
  let nested = 'leaf';
  for (let i = 0; i < 2000; i++) nested = { a: nested };
  const matches = findKey(nested, 'a');
  assert.equal(matches.length, 2000);
  assert.equal(matches[0].length, 1); // shallowest match first (document order)
  assert.equal(matches[matches.length - 1].length, 2000); // deepest match last
});
