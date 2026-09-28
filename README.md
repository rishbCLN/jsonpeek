# jsonpeek

[![CI](https://github.com/rishbCLN/jsonpeek/actions/workflows/ci.yml/badge.svg)](https://github.com/rishbCLN/jsonpeek/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/jsonpeek.svg)](https://www.npmjs.com/package/jsonpeek)
[![node](https://img.shields.io/node/v/jsonpeek.svg)](https://www.npmjs.com/package/jsonpeek)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A fast terminal JSON viewer that also hands you the jq path to any value.**

You piped an API response into your terminal and got this:

```
{"user":{"id":42,"name":"Ada","roles":["admin","dev"]},"items":[{"id":1,"sku":"A-1"},{"id":2,"sku":"B-2"}],"page":{"next":null}}
```

`jq` is great — *once you already know the path*. A browser JSON viewer is overkill
for a 2 MB response. jsonpeek sits in the middle: pretty, colored output, and a
built-in path finder so you can copy-paste the exact accessor you need.

```bash
npx jsonpeek data.json
```

```json
{
  "user": {
    "id": 42,
    "name": "Ada",
    "roles": [
      "admin",
      "dev"
    ]
  },
  "items": [
    { "id": 1, "sku": "A-1" },
    { "id": 2, "sku": "B-2" }
  ],
  "page": { "next": null }
}
```

(colored by token type in a real terminal — keys, strings, numbers, booleans and
`null` each get their own color)

No dependencies. No config. No account. Just Node 18+.

<!-- Add a colorful demo GIF here once recorded: ![demo](docs/demo.gif) -->

## The killer feature: find the path

Stop eyeballing brackets. Ask jsonpeek where a key lives:

```bash
$ jsonpeek data.json --find id --jq
.user.id
.items[0].id
.items[1].id
```

Grab a single value by path (jq **or** JS syntax, your choice):

```bash
$ jsonpeek data.json --path items[0].sku
"A-1"

$ echo '{"a":{"b":[1,2,3]}}' | jsonpeek --path .a.b
[
  1,
  2,
  3
]
```

Or dump every leaf path at once:

```bash
$ jsonpeek data.json --paths
user.id
user.name
user.roles[0]
user.roles[1]
items[0].id
...
```

## Quick start

```bash
# one-off, no install
npx jsonpeek package.json

# from a pipe (the natural habitat)
curl -s https://api.example.com/users | jsonpeek --depth 2
cat data.json | jsonpeek --compact

# or install globally
npm install -g jsonpeek
jsonpeek data.json
```

## Usage

```
jsonpeek [file] [options]
cat data.json | jsonpeek [options]
```

| Option | Description |
| --- | --- |
| `--path <expr>` | Print the value at a path (e.g. `data.items[0].id` or `.a.b`) |
| `--find <key>` | Print every path where `<key>` occurs |
| `--paths` | Print the path to every leaf value |
| `--jq` | Emit paths in jq form (leading dot); default is JS form |
| `--depth <n>` | Collapse objects/arrays deeper than `n` levels |
| `-c, --compact` | Print on a single line (no indentation) |
| `--color` | Force colored output |
| `--no-color` | Disable colored output |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

Exit codes: `0` success, `1` runtime failure (parse error, or `--path`/`--find`
found nothing), `2` bad usage.

## How it works

No magic, and nothing leaves your machine:

- **Read** JSON from a file argument or from piped stdin.
- **Parse** with `JSON.parse`, but wrap failures in a friendly error that points at
  the line, column, and offending character — never a raw stack trace.
- **Pretty-print** with a pure renderer that returns a string. With colors off the
  output is byte-for-byte valid JSON (`JSON.stringify(value, null, 2)`), so it stays
  clean in a pipe.
- **Find paths** by walking the parsed value iteratively (no recursion to overflow),
  producing both jq (`.a.b[0].c`) and JS (`a.b[0].c`) accessors, bracket-quoting keys
  that aren't identifiers (`["weird key"]`).

Colors auto-disable when stdout is not a TTY or when `NO_COLOR` is set, so
`jsonpeek data.json | less` and CI logs stay readable.

It is **read-only**: jsonpeek never writes files and never evaluates the input.

## Development

```bash
node --test              # run the test suite (Node built-in, zero deps)
node bin/jsonpeek.mjs --help
echo '{"a":1}' | node bin/jsonpeek.mjs
```

The core is a set of small pure functions — `parse.mjs`, `format.mjs`, and
`paths.mjs` — that are unit-tested with exact-string snapshots. Side effects
(reading a file or stdin) live behind an injectable reader in `read.mjs`, so tests
never block on real input.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues:
an interactive TTY explorer, `--stats` (key/type counts, max depth, byte size), and
NDJSON support.

## License

MIT. See [LICENSE](LICENSE).
