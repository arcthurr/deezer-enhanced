#!/usr/bin/env bash
# Builds Deezer Enhanced (with Better Deezer inside) and installs it for the current
# user: ~/.local/share/deezer-enhanced, a launcher entry and an icon. No root needed.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_ID=deezer-enhanced
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_ID"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"

npm run package

BUILD_DIR="$(ls -d out/${APP_ID}-linux-*/ 2>/dev/null | head -n 1 || true)"
if [[ -z "$BUILD_DIR" ]]; then
  echo "Could not find the packaged app in out/. Did 'npm run package' succeed?" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST" "$APPS" "$ICONS"
cp -a "${BUILD_DIR%/}/." "$DEST/"
cp build/icon.png "$ICONS/$APP_ID.png"

# %U lets the deezer:// login link from the browser reach the running app.
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
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "${ICONS%/hicolor/*}/hicolor" 2>/dev/null || true
command -v xdg-mime >/dev/null && xdg-mime default "$APP_ID.desktop" x-scheme-handler/deezer || true

echo
echo "Installed: $DEST"
echo "Launch 'Deezer Enhanced' from your app launcher, or run: $DEST/$APP_ID"
echo "Remove it with: npm run uninstall:local"
