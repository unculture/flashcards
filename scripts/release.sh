#!/bin/bash
# Makes a release: sets the version, commits, tags, and pushes. GitHub then
# builds the installers and publishes them (see .github/workflows/release.yml).
# Usage: scripts/release.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/release.sh <version>, for example 0.2.0" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi

# Set the version in the three places that hold it.
node -e '
  const fs = require("fs");
  const version = process.argv[1];
  for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.version = version;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  }
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  lock.version = version;
  lock.packages[""].version = version;
  fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
' "$version"
perl -0pi -e "s/^version = \".*?\"/version = \"$version\"/m" src-tauri/Cargo.toml
(cd src-tauri && cargo update -p flashcards --offline -q 2>/dev/null || true)

git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "Release $version"
git tag "v$version"
git push origin HEAD "v$version"
echo "Pushed v$version. The installers appear at https://github.com/unculture/flashcards/releases when the build finishes."
