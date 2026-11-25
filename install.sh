#!/usr/bin/env bash
# Builds Deezer Enhanced (with Better Deezer inside) and installs it as a desktop app
# for the current user: ~/.local/share/deezer-enhanced, a launcher entry and an icon.
# No root needed. Run it again to update: any older install is stopped and replaced.
# Your login and settings in ~/.config/deezer-enhanced are kept.
set -euo pipefail

cd "$(dirname "$0")"

APP_ID=deezer-enhanced
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/$APP_ID"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor/256x256/apps"

if ! command -v npm >/dev/null; then
  echo "npm not found. Install Node.js 22 (e.g. 'fnm install 22 && fnm use 22') and try again." >&2
  exit 1
fi

if [[ -e "$DEST" ]]; then
  echo "Found an existing install, it will be updated."
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm ci
fi

echo "Building..."
rm -rf out
npm run package

BUILD_DIR="$(ls -d out/${APP_ID}-linux-*/ 2>/dev/null | head -n 1 || true)"
if [[ -z "$BUILD_DIR" ]]; then
  echo "Could not find the packaged app in out/. Did 'npm run package' succeed?" >&2
  exit 1
fi

# Stop a running (old) instance so its files can be replaced.
if pgrep -f "$DEST/" >/dev/null 2>&1; then
  echo "Stopping the running app..."
  pkill -f "$DEST/" || true
  sleep 1
fi

rm -rf "$DEST"
mkdir -p "$DEST" "$APPS" "$ICONS"
cp -a "${BUILD_DIR%/}/." "$DEST/"
cp build/icon.png "$ICONS/$APP_ID.png"

# %U lets the deezer:// login link from the browser reach the running app.
# No GPU flags here: hardware acceleration is on, the app falls back by itself.
cat > "$APPS/$APP_ID.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Deezer Enhanced
Comment=Unofficial Deezer app with Better Deezer built in
Exec="$DEST/$APP_ID" %U
Icon=$APP_ID
Terminal=false
Categories=Audio;AudioVideo;
StartupWMClass=Deezer Enhanced
MimeType=x-scheme-handler/deezer;
DESKTOP

command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" 2>/dev/null || true
command -v xdg-mime >/dev/null && xdg-mime default "$APP_ID.desktop" x-scheme-handler/deezer || true

echo
echo "Installed: $DEST"
echo "Launch 'Deezer Enhanced' from your app launcher, or run: $DEST/$APP_ID"
echo "Remove everything with: ./uninstall.sh"
