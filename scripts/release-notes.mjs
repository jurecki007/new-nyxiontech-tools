// Prints the CHANGELOG.md section for one version (default: package.json's),
// used as the GitHub release text. Exits with an error if there is none.
import fs from 'node:fs';

const version = process.argv[2] ?? JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const lines = fs.readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);

/** "## [1.2.3] - 2026-01-01" or "## 1.2.3" → "1.2.3"; null for other lines. */
const headingVersion = (line) => /^##\s+\[?([^\]\s]+)\]?/.exec(line)?.[1] ?? null;

const start = lines.findIndex((l) => headingVersion(l) === version);
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
console.log(lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim());
