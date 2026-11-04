// Prints the CHANGELOG.md section for one version (default: package.json's),
// used as the GitHub release text. Exits with an error if there is none.
//
//   node scripts/release-notes.mjs [version] [--github]
//
// --github (used by the release workflow) adds a note on the Windows SmartScreen
// warning for the release page. Without it, only the changelog section is printed,
// which is what scripts/fix-latest-json.mjs puts into latest.json.
import fs from 'node:fs';

const args = process.argv.slice(2);
const github = args.includes('--github');
const version = args.find((a) => !a.startsWith('--')) ?? JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const lines = fs.readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);

/** "## [1.2.3] - 2026-01-01" or "## 1.2.3" → "1.2.3"; null for other lines. */
const headingVersion = (line) => /^##\s+\[?([^\]\s]+)\]?/.exec(line)?.[1] ?? null;

const start = lines.findIndex((l) => headingVersion(l) === version);
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
let notes = lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();

if (github) {
  notes += `

> **"Windows protected your PC"?** The installers are not code-signed yet (the SignPath Foundation application is pending), so SmartScreen warns about an unknown publisher. Click **More info → Run anyway**. To check your download, compare \`Get-FileHash <file>\` in PowerShell with the \`sha256:\` digest shown next to the file below. [More](https://github.com/jurecki007/nyxiontech-tools#why-does-windows-warn-me)`;
}
console.log(notes);
