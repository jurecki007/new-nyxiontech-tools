// Builds the desktop installers with the full WebView2 installer inside (about
// 240 MB instead of 36 MB), for machines without internet that may lack WebView2.
// The outputs get an "_offline" suffix; the normal installers are kept.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(root, 'src-tauri/target/release/bundle');
const kinds = [['nsis', /^(.*)-setup\.exe$/], ['msi', /^(.*)\.msi$/]];
const installers = (dir) => (existsSync(join(bundle, dir)) ? readdirSync(join(bundle, dir)).filter((n) => /\.(exe|msi)$/.test(n)) : []);

// Tauri writes to the same file names as the normal build: move those aside.
const aside = join(bundle, '.online');
rmSync(aside, { recursive: true, force: true });
for (const [dir] of kinds) {
  for (const name of installers(dir).filter((n) => !n.includes('_offline'))) {
    mkdirSync(join(aside, dir), { recursive: true });
    renameSync(join(bundle, dir, name), join(aside, dir, name));
  }
}

try {
  execSync('npx tauri build --config src-tauri/tauri.offline.conf.json', { cwd: root, stdio: 'inherit' });
  for (const [dir, pattern] of kinds) {
    for (const name of installers(dir)) {
      const m = name.match(pattern);
      if (!m || name.includes('_offline')) continue;
      const renamed = name.replace(m[1], `${m[1]}_offline`);
      renameSync(join(bundle, dir, name), join(bundle, dir, renamed));
      console.log(`${dir}/${renamed}`);
    }
  }
} finally {
  for (const [dir] of kinds) {
    for (const name of existsSync(join(aside, dir)) ? readdirSync(join(aside, dir)) : []) renameSync(join(aside, dir, name), join(bundle, dir, name));
  }
  rmSync(aside, { recursive: true, force: true });
}
