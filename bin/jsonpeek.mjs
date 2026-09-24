#!/usr/bin/env node
// jsonpeek — a fast terminal JSON viewer that also hands you the jq path to any value.
// Read-only: it never writes files and never evaluates the input.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseArgs, HELP } from '../src/args.mjs';
import { parseJson, formatParseError, JsonParseError } from '../src/parse.mjs';
import { format } from '../src/format.mjs';
import { getByPath, findKey, listPaths, toJqPath, toJsPath } from '../src/paths.mjs';
import { makeStyler, colorEnabled } from '../src/ui.mjs';
import { readInput } from '../src/read.mjs';

function getVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`jsonpeek ${getVersion()}\n`);
    return 0;
  }

  const c = makeStyler(colorEnabled(process.env, process.stdout, opts.color));

  if (opts.errors.length) {
    for (const e of opts.errors) process.stderr.write(`${c.red('error:')} ${e}\n`);
    process.stderr.write(`\nRun ${c.cyan('jsonpeek --help')} for usage.\n`);
    return 2;
  }

  // 1. Resolve input: file argument or piped stdin.
  let source;
  try {
    ({ source } = await readInput({ file: opts.file, stdin: process.stdin }));
  } catch (err) {
    process.stderr.write(`${c.red('error:')} cannot read ${opts.file}: ${err.message || err}\n`);
    return 1;
  }

  if (source == null) {
    process.stderr.write(`${c.red('error:')} no input \u2014 pass a file or pipe JSON via stdin\n\n`);
    process.stderr.write(HELP);
    return 2;
  }
  if (!source.trim()) {
    process.stderr.write(`${c.red('error:')} input is empty \u2014 nothing to parse\n`);
    return 1;
  }

  // 2. Parse with a friendly error (never a raw stack trace).
  let data;
  try {
    data = parseJson(source);
  } catch (err) {
    if (err instanceof JsonParseError) {
      process.stderr.write(`${formatParseError(err, c)}\n`);
      return 1;
    }
    process.stderr.write(`${c.red('error:')} ${err.message || err}\n`);
    return 1;
  }

  const depth = opts.depth == null ? undefined : opts.depth;
  const maxArray = opts.maxArray == null ? undefined : opts.maxArray;

  try {
    // 3a. --path: print the value at a single path.
    if (opts.path != null) {
      const picked = getByPath(data, opts.path);
      if (picked === undefined) {
        process.stderr.write(`${c.red('error:')} no value at path ${c.bold(opts.path)}\n`);
        return 1;
      }
      process.stdout.write(`${format(picked, { styler: c, depth, maxArray, compact: opts.compact })}\n`);
      return 0;
    }

    // 3b. --find: print every path where a key occurs.
    if (opts.find != null) {
      const matches = findKey(data, opts.find);
      if (matches.length === 0) return 1; // scriptable: no matches -> non-zero, no output
      const render = opts.jq ? toJqPath : toJsPath;
      for (const segs of matches) process.stdout.write(`${render(segs)}\n`);
      return 0;
    }

    // 3c. --paths: print the path to every leaf.
    if (opts.listPaths) {
      const all = listPaths(data, { jq: opts.jq });
      if (all.length === 0) return 1;
      for (const p of all) process.stdout.write(`${p}\n`);
      return 0;
    }

    // 3d. default: pretty-print the whole document.
    process.stdout.write(`${format(data, { styler: c, depth, maxArray, compact: opts.compact })}\n`);
    return 0;
  } catch (err) {
    // e.g. pathological nesting tripping the format depth guard.
    process.stderr.write(`${c.red('error:')} ${err.message || err}\n`);
    return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`unexpected error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
