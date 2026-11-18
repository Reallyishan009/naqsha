#!/bin/sh
# Kiro PostFileSave hook: regenerate tests/fixtures/ after a change to a card
# profile or to the generator, and fail loudly if any PNG changed.
# JSON ground-truth changes are reported but do not fail the hook.
# The regenerated files are left in place so `git diff` shows what changed.
# To discard them: git checkout -- tests/fixtures
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

before=$(mktemp)
after=$(mktemp)
trap 'rm -f "$before" "$after"' EXIT

shasum tests/fixtures/*.png tests/fixtures/*.json > "$before" 2>/dev/null

if ! node scripts/make_fixtures.ts --all > /dev/null; then
  echo "FIXTURES: the generator failed; tests/fixtures may be partly rewritten." >&2
  exit 1
fi

shasum tests/fixtures/*.png tests/fixtures/*.json > "$after" 2>/dev/null

changed=$(diff "$before" "$after" | grep '^>' | awk '{print $3}')
png_changed=$(printf '%s\n' "$changed" | grep '\.png$' || true)
json_changed=$(printf '%s\n' "$changed" | grep '\.json$' || true)

if [ -n "$png_changed" ]; then
  {
    echo "=================================================================="
    echo "FIXTURES: PNG BYTES CHANGED. This was not expected."
    echo "These images differ from the committed versions:"
    printf '  %s\n' $png_changed
    echo "If the change is intended, review it with: git diff --stat tests/fixtures"
    echo "and commit it together with the profile or generator change."
    echo "If not, restore them with: git checkout -- tests/fixtures"
    echo "=================================================================="
  } >&2
  exit 1
fi

if [ -n "$json_changed" ]; then
  echo "fixtures regenerated; PNG bytes unchanged; ground-truth JSON changed:"
  printf '  %s\n' $json_changed
else
  echo "fixtures regenerated; all PNG and JSON bytes unchanged"
fi
