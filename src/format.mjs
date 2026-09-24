// PURE pretty-printer: (value, opts) -> string.
//
// With the default (identity) styler the output is byte-for-byte identical to
// `JSON.stringify(value, null, 2)` (or the compact form) — so it is valid,
// re-parseable JSON. Colors are applied per token type through an injected
// styler, which keeps the function pure and easy to snapshot-test with color off.

/** A no-op styler: every token type maps to the identity function. */
export function identityStyler() {
  const id = (s) => String(s);
  return { key: id, string: id, number: id, boolean: id, null: id, punctuation: id };
}

/** Hard ceiling on nesting we will recurse into, so pathological input can't blow the stack. */
export const MAX_DEPTH = 2000;

/**
 * Pretty-print a parsed JSON value to a colored string.
 * @param {*} value
 * @param {{
 *   styler?: object,     // { key,string,number,boolean,null,punctuation } style fns
 *   indent?: number,     // spaces per level (default 2)
 *   depth?: number,      // collapse containers at/below this nesting depth (default Infinity)
 *   compact?: boolean,   // single line, no whitespace (default false)
 *   maxArray?: number,   // truncate arrays longer than this (default Infinity)
 * }} [opts]
 * @returns {string}
 */
export function format(value, opts = {}) {
  const s = opts.styler || identityStyler();
  const indentUnit = opts.indent == null ? 2 : opts.indent;
  const maxDepth = opts.depth == null ? Infinity : opts.depth;
  const maxArray = opts.maxArray == null ? Infinity : opts.maxArray;
  const compact = Boolean(opts.compact);

  const p = (x) => s.punctuation(x);
  const nl = compact ? '' : '\n';
  const colonSpace = compact ? '' : ' ';
  const pad = (n) => (compact ? '' : ' '.repeat(indentUnit * n));

  const scalar = (v) => {
    if (v === null) return s.null('null');
    switch (typeof v) {
      case 'string':
        return s.string(JSON.stringify(v));
      case 'number':
        return s.number(Number.isFinite(v) ? String(v) : 'null');
      case 'boolean':
        return s.boolean(String(v));
      default:
        // undefined / function never appear in JSON.parse output; be safe anyway.
        return s.null('null');
    }
  };

  const render = (v, depth) => {
    if (depth > MAX_DEPTH) {
      throw new Error(`input nests deeper than the supported limit of ${MAX_DEPTH} levels`);
    }

    if (Array.isArray(v)) {
      if (v.length === 0) return p('[]');
      if (depth >= maxDepth) return p('[') + p('\u2026') + p(']');
      const limit = Math.min(v.length, maxArray);
      const items = [];
      for (let i = 0; i < limit; i++) {
        items.push(pad(depth + 1) + render(v[i], depth + 1));
      }
      if (v.length > limit) {
        items.push(pad(depth + 1) + p(`\u2026 (${v.length - limit} more)`));
      }
      return p('[') + nl + items.join(p(',') + nl) + nl + pad(depth) + p(']');
    }

    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 0) return p('{}');
      if (depth >= maxDepth) return p('{') + p('\u2026') + p('}');
      const items = keys.map(
        (k) => pad(depth + 1) + s.key(JSON.stringify(k)) + p(':') + colonSpace + render(v[k], depth + 1),
      );
      return p('{') + nl + items.join(p(',') + nl) + nl + pad(depth) + p('}');
    }

    return scalar(v);
  };

  return render(value, 0);
}
