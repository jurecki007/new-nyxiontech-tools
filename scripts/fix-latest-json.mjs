#!/usr/bin/env node
// Fixes latest.json on a GitHub release. Run it locally, before or after publishing:
//
//   node scripts/fix-latest-json.mjs v1.2.0            # rewrite and re-upload
//   node scripts/fix-latest-json.mjs v1.2.0 --dry-run  # only show what would change
//
// Why: the release workflow creates a *draft* release, and for drafts tauri-action
// writes API asset URLs into latest.json (api.github.com/.../releases/assets/<id>).
// Installed apps can't download those anonymously, so updates would fail. This
// script points every platform at the public download URL
// (github.com/<repo>/releases/download/<tag>/<file>), takes the notes from
// CHANGELOG.md (fixing broken characters such as "â€“"), and re-uploads the file.
//
// Needs the GitHub CLI (`gh`), logged in with write access to the repo. Runs on
// your PC, so it uses no GitHub Actions minutes.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'jurecki007/new-nyxiontech-tools';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tag = args.find((a) => !a.startsWith('--'));

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('Usage: node scripts/fix-latest-json.mjs v1.2.0 [--dry-run]');
  process.exit(1);
}

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const release = JSON.parse(gh('release', 'view', tag, '-R', REPO, '--json', 'assets,isDraft'));
const assets = release.assets;
if (!assets.some((a) => a.name === 'latest.json')) {
  console.error(`Release ${tag} has no latest.json. Has the release workflow finished?`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'latest-json-'));
try {
  gh('release', 'download', tag, '-R', REPO, '-p', 'latest.json', '-D', dir, '--clobber');
  const file = join(dir, 'latest.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const changes = [];

  // Point every platform at the public download URL of its asset.
  const publicUrl = (name) => `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(name)}`;
  const findAsset = (url) => {
    const last = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
    return (
      assets.find((a) => a.apiUrl === url) ??
      assets.find((a) => a.apiUrl.endsWith(`/assets/${last}`)) ??
      assets.find((a) => a.name === last || a.label === last)
    );
  };
  for (const [platform, entry] of Object.entries(json.platforms ?? {})) {
    const asset = findAsset(entry.url);
    if (!asset) {
      console.error(`${platform}: no release asset matches ${entry.url}`);
      process.exit(1);
    }
    const url = publicUrl(asset.name);
    if (entry.url !== url) {
      changes.push(`${platform}: ${entry.url}\n  -> ${url}`);
      entry.url = url;
    }
  }

  // Notes: the changelog section for this version, same as the release notes.
  const version = tag.slice(1);
  if (json.version !== version) {
    console.error(`latest.json says version ${json.version}, expected ${version}`);
    process.exit(1);
  }
  const notes = execFileSync('node', ['scripts/release-notes.mjs', version], { encoding: 'utf8' }).trim();
  if (json.notes !== notes) {
    changes.push('notes: replaced with the CHANGELOG.md section');
    json.notes = notes;
  }

  if (changes.length === 0) {
    console.log(`latest.json on ${tag} is already correct.`);
  } else {
    console.log(changes.join('\n'));
    if (dryRun) {
      console.log('\n--dry-run: nothing uploaded.');
    } else {
      writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      gh('release', 'upload', tag, file, '-R', REPO, '--clobber');
      console.log(`\nUploaded the fixed latest.json to ${tag}.`);
    }
  }

  // Once published, check that every download URL works without logging in.
  if (release.isDraft) {
    console.log('The release is still a draft: the download links work once you publish it.');
  } else {
    let ok = true;
    for (const [platform, entry] of Object.entries(json.platforms)) {
      const res = await fetch(entry.url, { method: 'HEAD', redirect: 'follow' });
      console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${platform} (${res.status})`);
      ok &&= res.ok;
    }
    if (!ok) process.exit(1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
