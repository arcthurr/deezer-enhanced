// Copies Gabizoc/Better-Deezer into vendor/better-deezer as plain files (no git
// submodule), so a normal `git clone` already contains everything.
//
//   node scripts/vendor-better-deezer.mjs          # latest main
//   node scripts/vendor-better-deezer.mjs v1.1.3   # a tag, branch or commit
//
// Commit the result. Re-run it whenever you want a newer Better Deezer.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/Gabizoc/Better-Deezer.git';
const ref = process.argv[2];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'vendor', 'better-deezer');
const tmp = mkdtempSync(join(tmpdir(), 'better-deezer-'));

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

try {
  git('clone', '--quiet', '--depth', '1', ...(ref ? ['--branch', ref] : []), REPO, tmp);
  const commit = git('-C', tmp, 'rev-parse', 'HEAD');
  const describe = git('-C', tmp, 'log', '-1', '--format=%cs %s');

  // Upstream's own CI and history are not needed in this repo.
  rmSync(join(tmp, '.git'), { recursive: true, force: true });
  rmSync(join(tmp, '.github'), { recursive: true, force: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(tmp, target, { recursive: true });

  writeFileSync(
    join(target, 'UPSTREAM.txt'),
    `Vendored from ${REPO}\nRef: ${ref ?? 'default branch'}\nCommit: ${commit}\nLast upstream commit: ${describe}\nLicense: MIT (see LICENSE)\n`
  );
  console.log(`[better-deezer] vendored ${commit.slice(0, 7)} -> ${target}`);
} catch (err) {
  console.error(
    '[better-deezer] could not download Better Deezer. If you passed a ref it may not exist, or you are offline.'
  );
  console.error(err.message);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
