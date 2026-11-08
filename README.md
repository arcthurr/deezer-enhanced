# @arcthurr's deezer-enhanced

An unofficial application for Deezer with enhanced features. This is a fork that is meant to get more features working, mainly from Gabizoc/Better-Deezer.
Nothing is updated yet.

## Credits

- @duzda: deezer-enhanced, the base of this app. More features are then added into the base deezer-enhanced made by @duzda.
- @Gabizoc: better-deezer, the plugin added to the app,themes and more features. Added as a electron extension.
- The Deezer application (website) designers.

## What is in this fork

- [duzda/deezer-enhanced](https://github.com/duzda/deezer-enhanced): the unofficial Deezer desktop app (tray, MPRIS, Discord presence, ...).
- [Gabizoc/Better-Deezer](https://github.com/Gabizoc/Better-Deezer) (MIT) built in: themes, theme Marketplace, synced lyrics, floating player and more. Its source is copied into `vendor/better-deezer/` (plain files, no git submodule, licence kept), built into `assets/better-deezer.user.js` and injected into Deezer on every page load.
- Settings has a **Better Deezer** section: on/off (Deezer reloads), live toggles for its main modules, and a button that opens Better Deezer's own panel (themes, Marketplace, sidebar, home).
- Adblock was removed.

## Get it running (anyone who clones this repo)

You need `git`, **Node.js 22 to 24** (22 LTS is what `.nvmrc` asks for, newer versions such as 26 break Electron's installer; `npm ci` refuses to run on them) and a C/C++ toolchain, because Electron's native modules are rebuilt (Arch/CachyOS: `base-devel`, Debian/Ubuntu: `build-essential`).

Node version manager, if you have none (Arch/CachyOS: `sudo pacman -S fnm`; add `fnm env --use-on-cd --shell fish | source` to `~/.config/fish/config.fish`, or the bash/zsh equivalent):

```
fnm install 22 && fnm use 22
git clone <this repo>
cd deezer-enhanced
npm ci
npm start
```

`npm start` builds Better Deezer first (`npm run bd:build`), so there is nothing else to set up.

## Use it as a normal desktop app

```
npm run install:local
```

This packages the app and installs it for your user only (no root): `~/.local/share/deezer-enhanced`, an app launcher entry called **Deezer Enhanced** and an icon. It also registers the `deezer://` link used for login. Update by running the command again, remove it with `npm run uninstall:local`. Your login and settings live in `~/.config/deezer-enhanced` and are kept.

Other formats (written to `out/make/`):

| Command | Result |
| --- | --- |
| `npm run make:appimage` | AppImage (needs `libarchive`/`bsdtar`) |
| `npm run make:pacman` | Arch package, install with `sudo pacman -U out/make/deezer-enhanced-*.pacman` |
| `npm run make` | everything the config lists: AppImage, pacman, deb and rpm (deb and rpm need `dpkg`, `fakeroot` and `rpm`) |

## Update Better Deezer

```
npm run bd:update            # newest Better Deezer from GitHub into vendor/
npm run bd:update -- v1.1.3  # or a specific tag, branch or commit
```

Then commit `vendor/better-deezer`. `vendor/better-deezer/UPSTREAM.txt` records which commit is in the repo.

## Troubleshooting

- **`npm ci` says "Fetching packages of type git have been disabled" (`EALLOWGIT`)**: npm 11+ blocks git dependencies. The repo's `.npmrc` sets `allow-git=all`; if your npm ignores it, run `npm ci --allow-git=all`.
- **"install scripts blocked" warnings**: npm 12 blocks install scripts unless they are listed in `allowScripts` in `package.json`. Electron, esbuild, Tailwind's engine and the two forge makers are already allowed there. The native `bufferutil`, `utf-8-validate` and `register-scheme` are denied on purpose: electron-forge rebuilds the native modules for Electron by itself.
- **"Electron failed to install correctly"** after `npm ci`: remove `node_modules/electron` and `~/.cache/electron`, switch to Node 22 (`fnm use 22`) and run `npm ci` again. On Node 26 the Electron unpacking was seen to stop after the first file, which is why `engines` and `engine-strict` now stop `npm ci` on unsupported Node versions.
- **Better Deezer does not show up**: check that `assets/better-deezer.user.js` exists (`npm run bd:build` creates it) and that Settings > Better Deezer is on.
