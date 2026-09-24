// Terminal presentation: manual ANSI colors, no dependency. Colors auto-disable
// for non-TTY stdout / NO_COLOR, and can be forced on/off. Mirrors portkill's ui.mjs.

/**
 * Build a styler. When `enabled` is false every function is a no-op passthrough.
 * Exposes JSON token colors plus a few colors for CLI messages.
 * @param {boolean} enabled
 */
export function makeStyler(enabled) {
  const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    enabled,
    // JSON token colors
    key: wrap(34, 39), // blue
    string: wrap(32, 39), // green
    number: wrap(33, 39), // yellow
    boolean: wrap(35, 39), // magenta
    null: wrap(90, 39), // bright black / grey
    punctuation: wrap(2, 22), // dim
    // message colors
    red: wrap(31, 39),
    cyan: wrap(36, 39),
    bold: wrap(1, 22),
    dim: wrap(2, 22),
  };
}

/**
 * Decide whether to emit colors. Precedence:
 *   explicit override ('always'/'never') > NO_COLOR > FORCE_COLOR > stdout.isTTY.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ isTTY?: boolean }} [stream]
 * @param {'always'|'never'|undefined} [override]
 * @returns {boolean}
 */
export function colorEnabled(env = process.env, stream = process.stdout, override) {
  if (override === 'never') return false;
  if (override === 'always') return true;
  if (env.NO_COLOR != null) return false;
  if (env.FORCE_COLOR != null) return true;
  return Boolean(stream && stream.isTTY);
}

/** Remove ANSI SGR escape sequences from a string (handy for tests / width math). */
export function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}
