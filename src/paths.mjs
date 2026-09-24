// PURE path utilities: enumerate paths to every leaf, format them in jq form
// (`.a.b[0].c`) or JS form (`a.b[0].c`), look a value up by a path expression,
// and find every path where a given key occurs. No I/O, no side effects.
//
// A "segment" is either { key: string } or { index: number }. Walks are iterative
// (explicit stack) so deeply nested input can never overflow the call stack.

/** True when `key` is a bare JS identifier and can use dot notation. */
export function isIdentifier(key) {
  return typeof key === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

/**
 * Render a segment list as a jq path (leading dot, bracket-quoted odd keys).
 * @param {Array<{key?:string,index?:number}>} segments
 * @returns {string}
 */
export function toJqPath(segments) {
  let out = '';
  for (const seg of segments) {
    if ('index' in seg) out += `[${seg.index}]`;
    else if (isIdentifier(seg.key)) out += `.${seg.key}`;
    else out += `[${JSON.stringify(seg.key)}]`;
  }
  if (out === '') return '.';
  if (out.startsWith('[')) out = `.${out}`; // ".[0]" / '.["odd key"]' stay valid jq
  return out;
}

/**
 * Render a segment list as a JS accessor (`a.b[0]["odd key"]`).
 * @param {Array<{key?:string,index?:number}>} segments
 * @returns {string}
 */
export function toJsPath(segments) {
  let out = '';
  segments.forEach((seg, i) => {
    if ('index' in seg) out += `[${seg.index}]`;
    else if (isIdentifier(seg.key)) out += i === 0 ? seg.key : `.${seg.key}`;
    else out += `[${JSON.stringify(seg.key)}]`;
  });
  return out;
}

/**
 * Reconstruct a segment list by following parent pointers from a leaf node up to
 * the root. The walkers below link each stack entry to its parent instead of
 * copying the whole prefix array at every level; copying was O(depth) per node,
 * making a deep chain O(depth^2) in time and allocations (a ~200k-deep document
 * would hang or exhaust the heap). Rebuilding once, only when a path is emitted,
 * keeps the walk linear in the size of the output it produces.
 * @param {{ parent: object|null, seg: object|null }} node
 * @returns {Array<{key?:string,index?:number}>}
 */
function segmentsOf(node) {
  const segs = [];
  for (let n = node; n && n.seg; n = n.parent) segs.push(n.seg);
  segs.reverse();
  return segs;
}

/**
 * Enumerate every leaf (scalar, or empty object/array) as { segments, value },
 * in document order.
 * @param {*} value
 * @returns {Array<{ segments: Array, value: * }>}
 */
export function leafPaths(value) {
  const out = [];
  const stack = [{ v: value, parent: null, seg: null }];
  while (stack.length) {
    const node = stack.pop();
    const v = node.v;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push({ segments: segmentsOf(node), value: v });
        continue;
      }
      for (let i = v.length - 1; i >= 0; i--) {
        stack.push({ v: v[i], parent: node, seg: { index: i } });
      }
    } else if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 0) {
        out.push({ segments: segmentsOf(node), value: v });
        continue;
      }
      for (let i = keys.length - 1; i >= 0; i--) {
        stack.push({ v: v[keys[i]], parent: node, seg: { key: keys[i] } });
      }
    } else {
      out.push({ segments: segmentsOf(node), value: v });
    }
  }
  return out;
}

/**
 * List every leaf path as a string.
 * @param {*} value
 * @param {{ jq?: boolean }} [opts]
 * @returns {string[]}
 */
export function listPaths(value, opts = {}) {
  const render = opts.jq ? toJqPath : toJsPath;
  return leafPaths(value).map((leaf) => render(leaf.segments));
}

/**
 * Find every path whose final key equals `key` (searches the whole tree, not
 * just leaves), in document order.
 * @param {*} value
 * @param {string} key
 * @returns {Array<Array>} array of segment lists
 */
export function findKey(value, key) {
  const out = [];
  const stack = [{ v: value, parent: null, seg: null }];
  while (stack.length) {
    const node = stack.pop();
    const v = node.v;
    if (node.seg && 'key' in node.seg && node.seg.key === key) out.push(segmentsOf(node));
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) {
        stack.push({ v: v[i], parent: node, seg: { index: i } });
      }
    } else if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      for (let i = keys.length - 1; i >= 0; i--) {
        stack.push({ v: v[keys[i]], parent: node, seg: { key: keys[i] } });
      }
    }
  }
  return out;
}

/** Locate the matching `]` for the `[` at `open`, skipping quoted strings. */
function findClosingBracket(s, open) {
  let quote = null;
  for (let i = open + 1; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ']') {
      return i;
    }
  }
  return -1;
}

/** Strip and unescape a quoted bracket key. */
function unquote(raw) {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'")) {
    return raw.slice(1, -1).replace(/\\(['\\])/g, '$1');
  }
  return raw;
}

/**
 * Parse a path expression (jq or JS form) into a segment list.
 * Accepts `.a.b[0].c`, `a.b[0].c`, `["odd key"].x`, `.[0]`, a lone `.` (root).
 * @param {string} expr
 * @returns {Array<{key?:string,index?:number}>}
 */
export function parsePath(expr) {
  const s = String(expr);
  const segments = [];
  let i = 0;
  if (s[i] === '.') i += 1; // optional leading dot
  while (i < s.length) {
    const ch = s[i];
    if (ch === '.') {
      i += 1;
      continue;
    }
    if (ch === '[') {
      const close = findClosingBracket(s, i);
      if (close === -1) throw new Error(`invalid path: unbalanced '[' in "${expr}"`);
      const inner = s.slice(i + 1, close).trim();
      if (/^-?\d+$/.test(inner)) {
        segments.push({ index: Number(inner) });
      } else if (
        (inner.startsWith('"') && inner.endsWith('"')) ||
        (inner.startsWith("'") && inner.endsWith("'"))
      ) {
        segments.push({ key: unquote(inner) });
      } else {
        segments.push({ key: inner });
      }
      i = close + 1;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== '.' && s[j] !== '[') j += 1;
    const word = s.slice(i, j);
    if (word) segments.push({ key: word });
    i = j;
  }
  return segments;
}

/**
 * Resolve a path expression against a value. Returns `undefined` when the path
 * does not exist. Negative array indices count from the end. PURE.
 * @param {*} value
 * @param {string|Array} expr path string or pre-parsed segments
 * @returns {*}
 */
export function getByPath(value, expr) {
  const segments = typeof expr === 'string' ? parsePath(expr) : expr;
  let cur = value;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if ('index' in seg) {
      if (!Array.isArray(cur)) return undefined;
      const idx = seg.index < 0 ? cur.length + seg.index : seg.index;
      cur = cur[idx];
    } else if (Array.isArray(cur)) {
      if (!/^-?\d+$/.test(seg.key)) return undefined;
      const n = Number(seg.key);
      cur = cur[n < 0 ? cur.length + n : n];
    } else if (cur && typeof cur === 'object') {
      if (!Object.prototype.hasOwnProperty.call(cur, seg.key)) return undefined;
      cur = cur[seg.key];
    } else {
      return undefined;
    }
  }
  return cur;
}
