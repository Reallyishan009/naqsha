#!/usr/bin/env bash
# Downloads the source fonts and subsets them into public/fonts/ (design-and-ux-pass, Requirements 1.1, 1.5, 1.6, 2.3 and 2.5).
#
# Dev only: nothing here is part of `npm run build`, and the woff2 files it writes are committed.
# One-time setup (see scripts/fonts/README.md):
#   python3 -m venv /tmp/naqsha-fonts && . /tmp/naqsha-fonts/bin/activate && pip install fonttools brotli
# Then, with the environment active, from the repository root:
#   scripts/fonts/subset.sh
set -euo pipefail

# The google/fonts commit the sources come from. Copy it into the Build_Log when it changes.
FONTS_REF="06bfe0d62a98375cb09c942fa18e68bd32cff057"
BASE_URL="https://raw.githubusercontent.com/google/fonts/${FONTS_REF}/ofl"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "${here}/../.." && pwd)"
source_dir="${here}/source"
output_dir="${root}/public/fonts"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

if ! command -v pyftsubset >/dev/null 2>&1; then
  echo "pyftsubset not found. Set up the Python environment first; see scripts/fonts/README.md." >&2
  exit 1
fi

mkdir -p "${source_dir}" "${output_dir}"

# A source directory from another commit must not be reused.
if [ "$(cat "${source_dir}/COMMIT" 2>/dev/null || true)" != "${FONTS_REF}" ]; then
  rm -f "${source_dir}"/*.ttf "${source_dir}"/*-OFL.txt
fi

# fetch <directory in google/fonts> <file there> <file name in source/>
fetch() {
  if [ ! -s "${source_dir}/$3" ]; then
    curl --fail --silent --show-error --location --retry 3 --output "${source_dir}/$3" "${BASE_URL}/$1/$2"
  fi
}

fetch rozhaone RozhaOne-Regular.ttf RozhaOne-Regular.ttf
fetch hind Hind-Regular.ttf Hind-Regular.ttf
fetch hind Hind-Bold.ttf Hind-Bold.ttf
fetch ibmplexmono IBMPlexMono-Regular.ttf IBMPlexMono-Regular.ttf
fetch rozhaone OFL.txt RozhaOne-OFL.txt
fetch hind OFL.txt Hind-OFL.txt
fetch ibmplexmono OFL.txt IBMPlexMono-OFL.txt
echo "${FONTS_REF}" > "${source_dir}/COMMIT"

# A font whose licence text is not the SIL Open Font License 1.1 is not copied (Requirement 2.2).
for licence in RozhaOne-OFL.txt Hind-OFL.txt IBMPlexMono-OFL.txt; do
  if ! grep -q "SIL OPEN FONT LICENSE Version 1.1" "${source_dir}/${licence}"; then
    echo "${licence} is not the SIL Open Font License 1.1. Nothing was written; record it and ask the user." >&2
    exit 1
  fi
done

node "${here}/codepoints.ts" "${work_dir}"
cat "${work_dir}/latin-symbols.txt" "${work_dir}/devanagari.txt" > "${work_dir}/latin-symbols-and-devanagari.txt"

# subset <source file> <unicodes file> <output file>
subset() {
  pyftsubset "${source_dir}/$1" \
    --unicodes-file="$2" \
    --flavor=woff2 \
    --layout-features='*' \
    --no-hinting \
    --output-file="${output_dir}/$3"
}

# Rozha One and Hind hold the Devanagari list as well; IBM Plex Mono does not.
subset RozhaOne-Regular.ttf "${work_dir}/latin-symbols-and-devanagari.txt" RozhaOne-Regular.woff2
subset Hind-Regular.ttf "${work_dir}/latin-symbols-and-devanagari.txt" Hind-Regular.woff2
subset Hind-Bold.ttf "${work_dir}/latin-symbols-and-devanagari.txt" Hind-Bold.woff2
subset IBMPlexMono-Regular.ttf "${work_dir}/latin-symbols.txt" IBMPlexMono-Regular.woff2

cp "${source_dir}/RozhaOne-OFL.txt" "${source_dir}/Hind-OFL.txt" "${source_dir}/IBMPlexMono-OFL.txt" "${output_dir}/"

node "${here}/report.ts"
