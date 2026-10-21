#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer only supports macOS." >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_app="$project_root/src-tauri/target/release/bundle/macos/Snipp.app"
install_dir="${SNIPP_INSTALL_DIR:-/Applications}"
installed_app="$install_dir/Snipp.app"
legacy_app="$install_dir/Snipp-Debug.app"

build_app=false
if [[ "${1:-}" == "--build" ]]; then
  build_app=true
  shift
fi

if [[ "$#" -ne 0 ]]; then
  echo "Usage: $0 [--build]" >&2
  exit 1
fi

if pgrep -x snipp-app >/dev/null 2>&1; then
  echo "Snipp is running. Quit it before installing, then run this command again." >&2
  exit 1
fi

if [[ "$build_app" == true ]]; then
  (cd "$project_root" && npm run tauri:build -- --bundles app)
fi

if [[ ! -d "$source_app" ]]; then
  echo "Release bundle not found at $source_app" >&2
  echo "Run 'npm run tauri:build -- --bundles app' first." >&2
  exit 1
fi

staging_dir="$(mktemp -d "$install_dir/.snipp-install.XXXXXX")"
previous_app="$staging_dir/previous-Snipp.app"

cleanup() {
  rm -rf -- "$staging_dir"
}
trap cleanup EXIT

ditto "$source_app" "$staging_dir/Snipp.app"

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$staging_dir/Snipp.app/Contents/Info.plist")"
if [[ "$bundle_id" != "com.ops.snipp" ]]; then
  echo "Unexpected bundle identifier: $bundle_id" >&2
  exit 1
fi

if [[ -e "$installed_app" ]]; then
  mv "$installed_app" "$previous_app"
fi

if ! mv "$staging_dir/Snipp.app" "$installed_app"; then
  if [[ -e "$previous_app" ]]; then
    mv "$previous_app" "$installed_app"
  fi
  echo "Could not install Snipp." >&2
  exit 1
fi

rm -rf -- "$previous_app"

if [[ -e "$legacy_app" ]]; then
  rm -rf -- "$legacy_app"
  echo "Removed obsolete $legacy_app"
fi

echo "Installed release build at $installed_app"
