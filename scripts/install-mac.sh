#!/bin/bash
# Builds Flashcards.app and installs it in /Applications, replacing an older copy.
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the project's Node version and the rustup toolchain, also from a plain shell.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null
fi
if [ -f "$HOME/.cargo/env" ]; then
  source "$HOME/.cargo/env"
fi

npx tauri build --bundles app

app="src-tauri/target/release/bundle/macos/Flashcards.app"
target="/Applications/Flashcards.app"

osascript -e 'quit app "Flashcards"' 2>/dev/null || true
rm -rf "$target"
cp -R "$app" "$target"
# An older version of this script installed in ~/Applications.
rm -rf "$HOME/Applications/Flashcards.app"
echo "Installed $target"
open "$target"
