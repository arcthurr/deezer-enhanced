#!/usr/bin/env bash
# Removes what scripts/install-local.sh installed. Your Deezer login and settings
# live in ~/.config/deezer-enhanced and are left alone.
set -euo pipefail

APP_ID=deezer-enhanced
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"

rm -rf "$DATA/$APP_ID"
rm -f "$DATA/applications/$APP_ID.desktop" "$DATA/icons/hicolor/256x256/apps/$APP_ID.png"
command -v update-desktop-database >/dev/null && update-desktop-database "$DATA/applications" || true

echo "Removed Deezer Enhanced from $DATA"
