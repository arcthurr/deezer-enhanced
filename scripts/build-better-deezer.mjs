// Builds the vendored Better Deezer (vendor/better-deezer, plain files) and
// copies its single-file payload to assets/better-deezer.user.js, which
// electron-forge ships as an extra resource (see forge.config.ts) and the main
// process injects into the Deezer view (src/main/better_deezer.ts).
//
//   npm run bd:build   (also runs before start / package / make)
//   npm run bd:update  (fetch a newer Better Deezer into vendor/)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'vendor', 'better-deezer');
const built = join(vendor, 'dist', 'better-deezer.user.js');
const target = join(root, 'assets', 'better-deezer.user.js');

if (!existsSync(join(vendor, 'scripts', 'build.mjs'))) {
  console.warn(
    '[better-deezer] vendor/better-deezer is missing. Run: npm run bd:update'
  );
  // In CI a missing payload would silently ship an app without Better Deezer.
  process.exit(process.env.CI ? 1 : 0);
}

execFileSync(process.execPath, [join(vendor, 'scripts', 'build.mjs')], {
  cwd: vendor,
  stdio: 'inherit',
});

mkdirSync(dirname(target), { recursive: true });
copyFileSync(built, target);
console.log(`[better-deezer] payload -> ${target}`);
