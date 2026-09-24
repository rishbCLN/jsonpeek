# jsonpeek — build instructions

> Self-contained build spec. A fresh session should be able to build, test, and ship this tool by following this file top to bottom. Do not add runtime dependencies.

| Field | Value |
| --- | --- |
| Product name | **jsonpeek** |
| Tagline | *A fast terminal JSON viewer that also hands you the jq path to any value.* |
| Folder id | `star-tool5-jsonpeek` |
| Intended repo / npm name | `jsonpeek` (verify; fallbacks: `jsonpeek-cli`, `peekjson`) |
| Status | Planned |
| License | MIT |

---

## 1. Problem & audience
`cat data.json` is unreadable, `jq` is powerful but you must already know the path, and firing up a browser tool for a 2MB API response is overkill. People want to *see* structure fast and grab the path/value they need.

**Audience:** API developers, data folks, anyone debugging JSON in a terminal.

## 2. Why it earns stars
- Beautiful colored tree output — **screenshots extremely well** (great for social posts).
- The killer feature: **"show me the jq path to this key"** — turns exploration into a copy-pasteable `jq`/JS accessor.
- Pairs naturally with `curl ... | jsonpeek` (pipe-friendly = viral in shell workflows).

## 3. Scope
**MVP**
- Read JSON from a file arg or **stdin** (`curl ... | jsonpeek`).
- Pretty tree with colors, key counts, and type hints; arrays show length.
- `--depth <n>` to collapse deep structures; large arrays truncated with "… (N more)".
- `--path <expr>` to print the value at a path (dot/bracket, e.g. `data.items[0].id`).
- `--find <key>` prints every path where a key occurs.

**Stretch**
- Interactive TUI mode (raw-mode arrows to expand/collapse; `p` copies path). Non-TTY falls back to static tree.
- `--jq` output mode: print results as jq filters.
- NDJSON support (`--ndjson`, one object per line).
- `--stats` (counts of keys/types, max depth, byte size).
- Handle huge files via streaming note (document limits; MVP loads into memory).

**Non-goals**
- Not a jq replacement / query language. No editing/writing JSON. No network fetching (that's the pipe's job).

## 4. Tech & constraints
- Node **>= 18**, ESM, **zero runtime deps**.
- Manual ANSI colors (respect `NO_COLOR` + non-TTY → no colors).
- `node:fs`, `node:readline` (for TUI), stdin via `process.stdin`.
- Entry `bin/jsonpeek.mjs`.

## 5. CLI / UX design
```
Usage: jsonpeek [file] [options]

Options:
  --path <expr>   Print value at path (e.g. data.items[0].id)
  --find <key>    Print all paths where <key> appears
  --depth <n>     Collapse below depth n
  --jq            Emit results as jq-style paths/filters
  --no-color      Disable colors
  -h, --help
  -v, --version

Examples:
  jsonpeek package.json
  curl -s api.example.com/users | jsonpeek --depth 2
  jsonpeek data.json --find id --jq
```

Example:
```
$ echo '{"user":{"id":42,"tags":["a","b"]}}' | jsonpeek
{
  user:
    id: 42            (number)
    tags: [2]         → a, b
}
path to "id":  .user.id     (jq: .user.id)
```

## 6. Architecture & file layout
```
jsonpeek/
  bin/jsonpeek.mjs
  src/input.mjs       # read file or stdin; parse; friendly parse-error with line/col
  src/tree.mjs        # pure: (value, opts) -> colored lines[]
  src/path.mjs        # pure: getByPath(obj, expr), findKey(obj, key) -> paths[]
  src/tui.mjs         # optional raw-mode explorer (stretch)
  src/ansi.mjs
  src/args.mjs
  test/path.test.mjs
  test/tree.test.mjs
  package.json
  README.md
  LICENSE
  CONTRIBUTING.md
  .github/workflows/ci.yml
  .gitignore
```

## 7. Implementation steps
1. Scaffold package.json/bin/license/gitignore.
2. `input.mjs`: read file or stdin fully; `JSON.parse` with a helpful error (show approx position).
3. `path.mjs`: `getByPath` + `findKey` (recursive, returns array of dot/bracket paths). **Pure + tested.**
4. `tree.mjs`: recursive renderer with depth limit, array truncation, type hints, colors. Pure (returns lines) for testability.
5. `ansi.mjs` + `args.mjs`.
6. Wire `bin`: file/stdin → parse → `--path`/`--find` or full tree; exit codes.
7. Stretch: `tui.mjs` interactive explorer.
8. Tests + CI + README + GIF (a colorful tree = the money shot).

## 8. Edge cases & safety
- Invalid JSON → clear message with approximate line/column, exit non-zero (don't dump a stack trace).
- Empty stdin / empty file → friendly message.
- Very large / deeply nested → respect `--depth`, truncate arrays, guard against pathological recursion (cap depth, detect cycles are impossible in parsed JSON but cap anyway).
- Non-TTY or `NO_COLOR` → plain output so pipes stay clean.
- `--path` on a missing path → print nothing + exit non-zero (scriptable).

## 9. Testing plan (`node --test`)
- `getByPath`: nested objects, array indices, missing → undefined.
- `findKey`: multiple occurrences → all correct paths; nested arrays.
- `tree`: depth limit collapses; array length shown; `NO_COLOR` yields no escape codes.
- `input`: invalid JSON throws the friendly error type.

## 10. README outline
Badges → the "unreadable JSON" pain → colorful tree GIF → `--path`/`--find` examples → pipe usage → options → install → contributing → license.

## 11. Distribution
`npm publish`, bin + shebang, tag, Release with GIF.

## 12. Launch checklist
Colorful GIF + a `curl | jsonpeek` example → Show HN → r/commandline, r/node, r/programming → dev.to → add to `awesome-zero-dependency`.

## 13. Definition of Done + star-magnet checklist
- [ ] Reads file **and** stdin; pipe-friendly.
- [ ] `--path` and `--find` return correct results.
- [ ] Colors auto-off for non-TTY/NO_COLOR.
- [ ] Graceful parse errors; no stack traces to users.
- [ ] CI green; tests pass; published; listed in awesome list.
