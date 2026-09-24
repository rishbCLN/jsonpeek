# Contributing to jsonpeek

Thanks for helping! jsonpeek is a small, **zero-dependency** Node CLI, and the goal is
to keep it that way: fast, obvious, pipe-friendly, and cross-platform.

## Principles

- **No runtime dependencies.** Everything uses Node built-ins (`node:fs`,
  `node:stream`, `node:process`). PRs that add a dependency will be asked to remove it.
  No `chalk`, no `jq`, no `inquirer` — the coloring and path logic are written by hand.
- **The core is pure.** Parsing (`parseJson`), pretty-printing (`format`), and path
  work (`getByPath`, `findKey`, `listPaths`) are pure functions that return strings or
  data — no I/O. That is what makes them easy to snapshot-test.
- **Side effects are thin and injectable.** Reading a file or stdin lives in
  `read.mjs` behind an injectable reader, so tests feed a string instead of blocking on
  real stdin. Colors come from an injected styler, so output is testable with color off.
- **Read-only and safe.** jsonpeek never writes files and never evaluates input.
  Invalid JSON produces a friendly line/column error and a non-zero exit, not a stack
  trace. Walks are iterative so deeply nested input can't overflow the stack.

## Getting started

```bash
git clone https://github.com/rishbCLN/jsonpeek.git
cd jsonpeek
node --test                       # run the suite
echo '{"a":{"b":1}}' | node bin/jsonpeek.mjs
```

There's nothing to install — no `npm install` step.

## Adding a feature or fixing a bug

1. Put the logic in the relevant pure module (`format.mjs`, `paths.mjs`, `parse.mjs`).
2. Add a test that asserts the exact string / value it should produce. For the
   pretty-printer, prefer exact-string snapshots with color **off**.
3. Keep `bin/jsonpeek.mjs` thin: it wires args → read → parse → format/paths and maps
   results to exit codes.

## Before you open a PR

- Run `node --test` — CI runs the same on Windows, macOS, and Linux across Node 18/20/22.
- Keep the change focused and update the README if you touch the CLI surface.
- Make sure pipes still work: `echo '{"a":1}' | node bin/jsonpeek.mjs` and
  `... | node bin/jsonpeek.mjs --path .a`.

## Ideas / good first issues

- Interactive TTY explorer (arrow keys to expand/collapse; `p` to copy a path),
  gated behind TTY detection so pipes always fall back to the static view.
- `--stats`: counts of keys/types, max depth, byte size.
- NDJSON support (`--ndjson`, one object per line).
- A short, colorful demo GIF for the README.
