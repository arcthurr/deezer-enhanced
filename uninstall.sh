#!/usr/bin/env bash
# Removes every trace of Deezer Enhanced for the current user: the app, launcher
# entry, icon, and all settings, login and cache. Dependencies (node_modules, Node)
# are left alone. Use -y to skip the confirmation.
set -euo pipefail

APP_ID=deezer-enhanced
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}"

# Electron may name its data folder after either the package or the product name.
DIRS=(
  "$DATA/$APP_ID"
  "$CONFIG/$APP_ID" "$CONFIG/Deezer Enhanced"
  "$CACHE/$APP_ID" "$CACHE/Deezer Enhanced"
)
FILES=(
  "$DATA/applications/$APP_ID.desktop"
  "$DATA/icons/hicolor/256x256/apps/$APP_ID.png"
  "$CONFIG/autostart/$APP_ID.desktop"
)

echo "This will delete the app AND all its settings and login:"
for p in "${DIRS[@]}" "${FILES[@]}"; do
  [[ -e "$p" ]] && echo "  $p"
done

if [[ "${1:-}" != "-y" ]]; then
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[yY]$ ]] || { echo "Aborted."; exit 1; }
fi

if pgrep -f "$DATA/$APP_ID/" >/dev/null 2>&1; then
  pkill -f "$DATA/$APP_ID/" || true
  sleep 1
fi

rm -rf "${DIRS[@]}"
rm -f "${FILES[@]}"

# Drop the deezer:// handler registration if it still points at us.
MIMEAPPS="$CONFIG/mimeapps.list"
if [[ -f "$MIMEAPPS" ]]; then
  sed -i "/$APP_ID.desktop/d" "$MIMEAPPS"
fi

command -v update-desktop-database >/dev/null && update-desktop-database "$DATA/applications" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" 2>/dev/null || true

echo "Deezer Enhanced has been removed."
