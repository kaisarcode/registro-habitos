#!/bin/sh
# Smoke-test the exact local HTML that KCAPK will package.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/build-app.sh" --prepare-only
PAGE="$ROOT/build/web/app.html"
MIGRATOR="$ROOT/build/web/index.html"
test -s "$MIGRATOR"
grep -q "appassets.androidplatform.net/app.html" "$MIGRATOR"
test -s "$PAGE"
grep -q 'id="capture-save"' "$PAGE"
grep -q 'id="capture-text"' "$PAGE"
grep -q 'id="edit-save"' "$PAGE"
grep -q 'id="reminder-confirm"' "$PAGE"
grep -q 'id="reminder-delete"' "$PAGE"
grep -q 'id="reminder-dialog-title"' "$PAGE"
grep -q 'async update(id,changes)' "$PAGE"
if grep -q 'id="reminder-new"' "$PAGE"; then
    echo 'Duplicate reminder add control was generated' >&2
    exit 1
fi
grep -q 'const reminderStore =' "$PAGE"
grep -q 'id="summary"' "$PAGE"
grep -q 'id="categories"' "$PAGE"
grep -q 'id="export-json"' "$PAGE"
grep -q 'id="import-json"' "$PAGE"
grep -q 'id="reminder-list"' "$PAGE"
grep -q 'const storage =' "$PAGE"
grep -q 'function suggestCategory' "$PAGE"
grep -q 'document.getElementById' "$PAGE"
if grep -q 'type="module"\|src="./app.bundle.js"' "$PAGE"; then
    echo 'Unexpected external JavaScript module in packaged HTML' >&2
    exit 1
fi
if command -v node >/dev/null 2>&1; then
    # Check the generated application script rather than separately checking
    # modules that deliberately contain import/export declarations.
    node --check "$ROOT/build/web/app.bundle.js"
fi
echo 'Packaged WebView HTML smoke test passed'
