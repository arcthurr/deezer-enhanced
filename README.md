# arcthurr's Deezer Enhanced

An unofficial desktop app for [Deezer](https://www.deezer.com) with [Better Deezer](https://github.com/Gabizoc/Better-Deezer) built in. One clean top bar, themes, a translucent mode, a full or compact player bar and every setting in one place. Not affiliated with Deezer.

> Status: personal project, Linux first (developed on Arch/CachyOS). It may work elsewhere but is untested.

## Features

- **One top bar**: back / forward, Home, centered search, settings, notifications and profile, all in a single floating bar that fades into the page.
- **Player bar**: full width, or a compact centered pill (Settings › Player bar).
- **Themes**: built-in and community themes, a Marketplace, a theme editor, light / dark / auto.
- **Translucent mode**: panels, cards, menus and dialogs turn see-through with a background blur, in three strengths. Optionally a **see-through window** that shows your desktop (needs a compositor and a restart).
- **Synced lyrics**, a full-screen "Now playing" view, sleep timer, smooth transitions, accent color from the cover, compact mode.
- **One settings panel** (the wrench in the top bar, or `Ctrl` + `,`): the app's own settings (tray, close / start in tray, notifications, Discord Rich Presence, non-linear volume curve, Better Deezer on / off, reset) sit next to all of Better Deezer's tabs.
- **Desktop integration** from the original app: tray, MPRIS media controls, Discord Rich Presence, volume scrolling, zoom.
- No adblock and no downloader: both were removed on purpose.

## Install

You need `git`, **Node.js 22 to 24** (`.nvmrc` asks for 22; newer versions break Electron's installer and `npm ci` refuses them) and a C/C++ toolchain, because Electron's native modules are rebuilt (Arch/CachyOS: `base-devel`, Debian/Ubuntu: `build-essential`).

```
# Node version manager if you have none (Arch/CachyOS: sudo pacman -S fnm)
fnm install 22 && fnm use 22

git clone https://github.com/arcthurr/deezer-enhanced
cd deezer-enhanced
npm ci
```

### Try it (development)

```
npm start
```

`npm start` builds Better Deezer first, so there is nothing else to set up.

### Install as a normal app (no root)

```
npm run install:local
```

Packages the app and installs it to `~/.local/share/deezer-enhanced` with a **Deezer Enhanced** launcher entry and icon, and registers the `deezer://` link used for login. Run it again to update; `npm run uninstall:local` removes it. Your login and settings in `~/.config/deezer-enhanced` are kept.

### Other formats (written to `out/make/`)

| Command | Result |
| --- | --- |
| `npm run make:appimage` | AppImage (needs `libarchive` / `bsdtar`) |
| `npm run make:pacman` | Arch package: `sudo pacman -U out/make/deezer-enhanced-*.pacman` |
| `npm run make` | everything the config lists: AppImage, pacman, deb, rpm (deb and rpm need `dpkg`, `fakeroot`, `rpm`) |

## Using it

- **Settings**: the wrench in the top bar. *Deezer Enhanced* tabs hold the app's settings, *Better Deezer* tabs hold themes, modules, appearance, sidebar, playback, home and more.
- **Translucent mode**: Settings › Themes › Translucency. For the desktop to show through, also turn on *See-through window* and restart. To blur the desktop as well, add a "Blur" rule for the window in your window manager (for example KWin).
- **Custom CSS**: put a `style.css` in `~/.config/deezer-enhanced`; it is hot reloaded. See [THEMING.md](THEMING.md).
- **If Better Deezer is off**: the app falls back to its original layout (a tool strip above Deezer and the old settings page), where you can turn it back on.

## How it is built

- Electron + Vite + TypeScript. `src/main` is the main process, `src/view` runs inside the Deezer page, `src/renderer` is the small React UI used for login and the legacy layout.
- Better Deezer's source lives as plain files in `vendor/better-deezer/` (no submodule, licence kept). It is built into `assets/better-deezer.user.js` and injected into Deezer on every page load.
- This fork adds to the vendored code: the desktop top bar (`features/desktop-bar.js`), the app settings tabs (`features/app-settings.js`), the app bridge (`core/40-app.js`), the Player bar tab and the extended translucent mode. `npm run bd:update` replaces `vendor/better-deezer/`, so these changes must be re-applied (or merged) after an update.

```
npm run bd:build            # rebuild the Better Deezer payload
npm run bd:update           # newest Better Deezer from GitHub into vendor/
npm run bd:update -- v1.1.3 # a specific tag, branch or commit
npm run lint
```

## Troubleshooting

- **`npm ci` says "Fetching packages of type git have been disabled" (`EALLOWGIT`)**: npm 11+ blocks git dependencies. `.npmrc` sets `allow-git=all`; if your npm ignores it, run `npm ci --allow-git=all`.
- **"install scripts blocked" warnings**: npm 12 blocks install scripts unless listed in `allowScripts` in `package.json`. Electron, esbuild, Tailwind's engine and the forge makers are allowed; the native `bufferutil`, `utf-8-validate` and `register-scheme` are denied on purpose because electron-forge rebuilds native modules itself.
- **"Electron failed to install correctly"**: remove `node_modules/electron` and `~/.cache/electron`, switch to Node 22 (`fnm use 22`) and run `npm ci` again.
- **Better Deezer does not show up**: check that `assets/better-deezer.user.js` exists (`npm run bd:build`) and that Settings › Advanced › Enable Better Deezer is on.
- **See-through window is black**: your session has no compositor, or the window was not restarted after enabling it.

## Credits

- [duzda/deezer-enhanced](https://github.com/duzda/deezer-enhanced): the original app this is a fork of (tray, MPRIS, Discord presence).
- [Gabizoc/Better-Deezer](https://github.com/Gabizoc/Better-Deezer) (MIT): themes, Marketplace, lyrics, floating player and the panel this project's settings build on.
- The Deezer web player and its designers. Deezer is a trademark of its owner; this project is not affiliated with or endorsed by Deezer.

## License

MIT, see [LICENSE](LICENSE). Better Deezer's own MIT licence is kept in `vendor/better-deezer/LICENSE`.
