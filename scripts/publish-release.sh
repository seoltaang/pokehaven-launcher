#!/usr/bin/env bash
# Publish the staged modpack to a GitHub release.
#
# Build the manifest with the release download base as --base-url so file URLs
# are already correct (no rewrite needed), e.g.:
#   npm run build:manifest -- --profile "<profile>" --pack-version <v> \
#     --base-url "https://github.com/<owner>/<repo>/releases/download/<tag>"
#
# Then:  GH=/path/to/gh.exe REPO=owner/name TAG=modpack ./scripts/publish-release.sh
#
# Notes: the manifest builder skips 0-byte files (GitHub rejects empty assets).
# gh receives file paths as separate args, so Git Bash converts /e/... to E:\...
set -euo pipefail
GH="${GH:-gh}"
STAGE="$(cd "$(dirname "$0")/.." && pwd)/out/manifest-stage"

echo ">> ensuring release '$TAG' exists on $REPO"
"$GH" release view "$TAG" -R "$REPO" >/dev/null 2>&1 \
  || "$GH" release create "$TAG" -R "$REPO" --title "PokeHaven modpack files" \
       --notes "Modpack assets (content-addressed by sha1)."

echo ">> uploading $(ls "$STAGE/files" | wc -l) files + manifest.json (clobber)"
"$GH" release upload "$TAG" -R "$REPO" --clobber "$STAGE"/files/*
"$GH" release upload "$TAG" -R "$REPO" --clobber "$STAGE/manifest.json"

echo ">> DONE: https://github.com/$REPO/releases/download/$TAG/manifest.json"
