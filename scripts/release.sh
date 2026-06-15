#!/usr/bin/env bash
#
# Cut a tagged GitHub Release of the user guide.
#
# Reads VERSION (semver), builds the zip + pdf with version-stamped names,
# creates and pushes a git tag, and publishes a GitHub Release with the
# artefacts attached and notes generated from commits since the previous
# tag.
#
# Designed to be safe to invoke from any directory and to refuse anything
# that would publish a release that doesn't match the current commit.
#
# Usage:
#   bash scripts/release.sh
#   # or, preferred:
#   make release
#
# Bumping the version: edit VERSION, commit, then `make release`.

set -euo pipefail

# Anchor every path to this script's directory (consistent with the
# Makefile's ROOT convention).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

if [[ ! -f VERSION ]]; then
  echo "❌ VERSION file missing. Create it with a semver string, e.g. 0.1.0" >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < VERSION)"
if [[ -z "$VERSION" ]]; then
  echo "❌ VERSION is empty." >&2
  exit 1
fi

# semver: MAJOR.MINOR.PATCH with optional pre-release / build metadata.
SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
if ! [[ "$VERSION" =~ $SEMVER_RE ]]; then
  echo "❌ VERSION '$VERSION' is not valid semver (e.g. 0.1.0 or 1.2.3-rc.1)." >&2
  exit 1
fi
TAG="v$VERSION"

# Need a clean working tree so the tag points at a meaningful commit.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is dirty. Commit or stash changes before releasing." >&2
  git status --short >&2
  exit 1
fi

# Refuse to release if HEAD isn't on origin yet — the tag would point at
# a commit nobody else can reach.
if ! git merge-base --is-ancestor HEAD "@{u}" 2>/dev/null; then
  REMOTE_HEAD="$(git rev-parse @{u} 2>/dev/null || echo '<no upstream>')"
  LOCAL_HEAD="$(git rev-parse HEAD)"
  if [[ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]]; then
    echo "❌ HEAD ($LOCAL_HEAD) is not on origin yet. Push the current branch first." >&2
    exit 1
  fi
fi

# Tag must not already exist locally or on origin.
if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  echo "❌ Tag $TAG already exists locally. Bump VERSION or delete the tag." >&2
  exit 1
fi
if git ls-remote --tags origin "refs/tags/$TAG" | grep -q .; then
  echo "❌ Tag $TAG already exists on origin." >&2
  exit 1
fi

# gh CLI must be installed and authenticated.
if ! command -v gh >/dev/null; then
  echo "❌ gh CLI is required (https://cli.github.com)." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build artefacts with version-stamped names
# ---------------------------------------------------------------------------

PACKAGE="semantic-firewall-user-guide-$TAG"
DIST="$ROOT/dist"
ZIP="$DIST/$PACKAGE.zip"
PDF="$DIST/$PACKAGE.pdf"

echo "▶ building artefacts for $TAG"
# Override PACKAGE so make stamps the version into the filenames.
make -C "$ROOT" package PACKAGE="$PACKAGE"

# Sanity: both artefacts exist and are non-empty.
for f in "$ZIP" "$PDF"; do
  if [[ ! -s "$f" ]]; then
    echo "❌ expected artefact missing or empty: $f" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Tag + publish
# ---------------------------------------------------------------------------

echo "▶ tagging $TAG and pushing"
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

echo "▶ creating GitHub Release $TAG"
# --generate-notes produces release notes from commits since the previous
# tag; for the very first release it falls back to a sensible default.
gh release create "$TAG" \
  --title "$TAG" \
  --generate-notes \
  "$ZIP" \
  "$PDF"

echo
echo "✓ released $TAG"
echo "  $ZIP"
echo "  $PDF"
