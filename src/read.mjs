// Thin, injectable input reader: a file (via node:fs) or piped stdin. Kept small
// and dependency-injected so tests can feed a string without ever touching real
// stdin (which would block) or the filesystem.
import { readFileSync } from 'node:fs';

/**
 * Read a whole stream to a UTF-8 string.
 * @param {NodeJS.ReadableStream} stream
 * @returns {Promise<string>}
 */
export function readStream(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    if (stream.setEncoding) stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

/**
 * Resolve the input source: a file when `file` is given, otherwise piped stdin.
 * Returns `{ source: null }` when there is neither a file nor a pipe (interactive
 * TTY with no input) so the caller can show help instead of hanging.
 *
 * @param {{
 *   file?: string|null,
 *   stdin?: NodeJS.ReadableStream & { isTTY?: boolean },
 *   isTTY?: boolean,
 *   readFile?: (path: string) => string,
 * }} [opts]
 * @returns {Promise<{ source: string|null, origin: string }>}
 */
export async function readInput(opts = {}) {
  const file = opts.file ?? null;
  const stdin = opts.stdin || process.stdin;
  const isTTY = opts.isTTY != null ? opts.isTTY : Boolean(stdin && stdin.isTTY);
  const readFile = opts.readFile || ((p) => readFileSync(p, 'utf8'));

  if (file != null) {
    return { source: readFile(file), origin: file };
  }
  if (isTTY) {
    return { source: null, origin: 'tty' };
  }
  return { source: await readStream(stdin), origin: 'stdin' };
}
