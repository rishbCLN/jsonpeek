// Zero-dependency argument parsing + HELP text. Kept pure so it is fully unit-testable.

export const HELP = `jsonpeek \u2014 a fast terminal JSON viewer that hands you the jq path to any value

Usage:
  jsonpeek [file] [options]
  cat data.json | jsonpeek [options]

Options:
      --path <expr>   Print the value at a path (e.g. data.items[0].id or .a.b)
      --find <key>    Print every path where <key> occurs
      --paths         Print the path to every leaf value
      --jq            Emit paths in jq form (leading dot); default is JS form
      --depth <n>     Collapse objects/arrays deeper than n levels
      --max-array <n> Show only the first n array elements (\u2026 N more)
  -c, --compact       Print on a single line (no indentation)
      --color         Force colored output
      --no-color      Disable colored output
  -h, --help          Show this help
  -v, --version       Show the version

Examples:
  jsonpeek package.json
  curl -s https://api.example.com/users | jsonpeek --depth 2
  jsonpeek data.json --path data.items[0].id
  jsonpeek data.json --find id --jq

Notes:
  * Reads from a file argument, or from stdin when piped.
  * Read-only: jsonpeek never writes files or evaluates the input.
  * Colors auto-disable when stdout is not a TTY or NO_COLOR is set.

Exit codes: 0 ok, 1 runtime failure (parse error / path not found), 2 usage error.
`;

const VALUE_OPTS = new Set(['--path', '--find', '--depth', '--max-array']);

/**
 * Parse argv (excluding node + script path).
 * @param {string[]} argv
 * @returns {{
 *   file: string|null, path: string|null, find: string|null,
 *   listPaths: boolean, jq: boolean, depth: number|null, compact: boolean,
 *   maxArray: number|null,
 *   color: 'always'|'never'|undefined, help: boolean, version: boolean, errors: string[]
 * }}
 */
export function parseArgs(argv) {
  const result = {
    file: null,
    path: null,
    find: null,
    listPaths: false,
    jq: false,
    depth: null,
    maxArray: null,
    compact: false,
    color: undefined,
    help: false,
    version: false,
    errors: [],
  };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let inlineValue = null;
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }

    // Consume a value for options that need one (supports `--opt val` and `--opt=val`).
    const takeValue = () => {
      if (inlineValue != null) return inlineValue;
      const next = argv[i + 1];
      if (next == null) return null;
      i += 1;
      return next;
    };

    switch (arg) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-v':
      case '--version':
        result.version = true;
        break;
      case '--jq':
        result.jq = true;
        break;
      case '--paths':
        result.listPaths = true;
        break;
      case '-c':
      case '--compact':
        result.compact = true;
        break;
      case '--color':
        result.color = 'always';
        break;
      case '--no-color':
        result.color = 'never';
        break;
      case '--path': {
        const v = takeValue();
        if (v == null) result.errors.push('--path requires a value');
        else result.path = v;
        break;
      }
      case '--find': {
        const v = takeValue();
        if (v == null) result.errors.push('--find requires a value');
        else result.find = v;
        break;
      }
      case '--depth': {
        const v = takeValue();
        if (v == null) {
          result.errors.push('--depth requires a value');
          break;
        }
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) {
          result.errors.push(`invalid --depth "${v}" (must be a non-negative integer)`);
        } else {
          result.depth = n;
        }
        break;
      }
      case '--max-array': {
        const v = takeValue();
        if (v == null) {
          result.errors.push('--max-array requires a value');
          break;
        }
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) {
          result.errors.push(`invalid --max-array "${v}" (must be a non-negative integer)`);
        } else {
          result.maxArray = n;
        }
        break;
      }
      default: {
        if (inlineValue != null && VALUE_OPTS.has(arg)) {
          // handled above via takeValue(); unreachable, but keep exhaustive.
          break;
        }
        if (arg.length > 1 && arg.startsWith('-')) {
          result.errors.push(`unknown option: ${arg}`);
          break;
        }
        if (result.file != null) {
          result.errors.push(`unexpected extra argument: ${arg}`);
        } else {
          result.file = arg;
        }
      }
    }
  }

  return result;
}
