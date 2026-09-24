// Friendly, PURE JSON parsing.
//
// `JSON.parse`'s error messages vary across Node versions ("... at position 12",
// "... (line 3 column 5)", "Unexpected end of JSON input"). Rather than trust any
// one format, we extract a character offset when we can and compute the line/column
// (and a caret snippet) ourselves. Everything here is pure and unit-testable.

/** Error thrown for invalid JSON. Carries structured location info. */
export class JsonParseError extends Error {
  constructor({ reason, line, column, offset, snippet }) {
    const loc = line != null && column != null ? ` at line ${line}, column ${column}` : '';
    super(`invalid JSON: ${reason}${loc}`);
    this.name = 'JsonParseError';
    this.reason = reason;
    this.line = line ?? null;
    this.column = column ?? null;
    this.offset = offset ?? null;
    this.snippet = snippet ?? null;
  }
}

/**
 * Convert a character offset into a 1-based { line, column }.
 * @param {string} text
 * @param {number} offset
 */
export function locate(text, offset) {
  const limit = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < limit; i++) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/**
 * Pull a 0-based character offset out of a `JSON.parse` error message.
 * Returns null when the message carries no position we can use.
 * @param {string} message
 * @param {string} text
 */
export function extractOffset(message, text) {
  const pos = /position (\d+)/i.exec(message);
  if (pos) {
    return Math.max(0, Math.min(Number(pos[1]), text.length));
  }
  if (/unexpected end of (?:json )?input/i.test(message)) {
    return text.length;
  }
  return null;
}

/** Strip Node's version-specific position/validity chatter down to the core reason. */
export function cleanReason(message) {
  let m = String(message);
  m = m.replace(/\s+in JSON at position \d+.*$/i, '');
  m = m.replace(/\s+at position \d+.*$/i, '');
  m = m.replace(/,\s*"[\s\S]*?"\s*is not valid JSON.*$/i, '');
  m = m.replace(/^unexpected end of (?:json )?input.*$/i, 'unexpected end of input');
  return m.trim() || 'could not parse input';
}

/**
 * Build a two-line snippet: the offending source line with a caret beneath the
 * column. Very long lines are windowed around the caret so the terminal stays sane.
 * @param {string} text
 * @param {number} line 1-based
 * @param {number} column 1-based
 */
export function caretSnippet(text, line, column) {
  const rows = text.split('\n');
  let src = (rows[line - 1] != null ? rows[line - 1] : '').replace(/\t/g, ' ');
  let caretCol = Math.max(1, column);
  const MAX = 120;
  if (src.length > MAX) {
    const half = Math.floor(MAX / 2);
    let start = Math.max(0, caretCol - half);
    const end = Math.min(src.length, start + MAX);
    start = Math.max(0, end - MAX);
    const lead = start > 0 ? '\u2026' : '';
    const trail = end < src.length ? '\u2026' : '';
    src = lead + src.slice(start, end) + trail;
    caretCol = caretCol - start + lead.length;
  }
  const gutter = `  ${line} | `;
  const caretLine = `${' '.repeat(gutter.length + Math.max(0, caretCol - 1))}^`;
  return `${gutter}${src}\n${caretLine}`;
}

/**
 * Parse JSON text, throwing a {@link JsonParseError} (never a raw SyntaxError)
 * with location info on failure. Pure: no I/O, no globals touched.
 * A leading UTF-8 byte-order mark is stripped (common in Windows-authored files).
 * @param {string} source
 * @returns {*}
 */
export function parseJson(source) {
  const text = String(source).replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch (err) {
    const message = (err && err.message) || String(err);
    const offset = extractOffset(message, text);
    let line = null;
    let column = null;
    let snippet = null;
    if (offset != null) {
      ({ line, column } = locate(text, offset));
      snippet = caretSnippet(text, line, column);
    }
    throw new JsonParseError({ reason: cleanReason(message), line, column, offset, snippet });
  }
}

const passthrough = (s) => String(s);

/**
 * Render a {@link JsonParseError} as a friendly, multi-line string.
 * PURE: colors come from an optional injected styler so it is testable with color off.
 * @param {JsonParseError} err
 * @param {{ red?: Function, dim?: Function }} [style]
 */
export function formatParseError(err, style = {}) {
  const red = style.red || passthrough;
  const dim = style.dim || passthrough;
  const lines = [`${red('error:')} ${err.message}`];
  if (err.snippet) lines.push(dim(err.snippet));
  return lines.join('\n');
}
