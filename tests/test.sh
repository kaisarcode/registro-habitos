#!/bin/sh
# Smoke-test the exact local HTML that KCAPK will package.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/build.sh" --prepare-only
PAGE="$ROOT/build/web/app.html"
MIGRATOR="$ROOT/build/web/index.html"
test -s "$MIGRATOR"
grep -q "appassets.androidplatform.net/app.html" "$MIGRATOR"
test -s "$PAGE"
grep -q 'name="app-build"' "$PAGE"
grep -q 'id="build-version"' "$PAGE"
grep -q 'id="capture-save"' "$PAGE"
grep -q 'id="capture-text"' "$PAGE"
grep -q 'id="quick-categories"' "$PAGE"
grep -q 'id="entry-dialog"' "$PAGE"
grep -q 'id="entry-status"' "$PAGE"
grep -q 'id="add-entry"' "$PAGE"
grep -q 'id="undo-quick"' "$PAGE"
grep -q 'function saveQuickCategory(category)' "$PAGE"
if grep -q 'id="suggestions"' "$PAGE"; then
    echo 'Old suggestions menu is still packaged' >&2
    exit 1
fi
grep -q 'id="edit-save"' "$PAGE"
grep -q 'id="reminder-confirm"' "$PAGE"
grep -q 'id="reminder-delete"' "$PAGE"
grep -q 'id="reminder-dialog-title"' "$PAGE"
grep -q 'async update(id,changes)' "$PAGE"
grep -q 'function openReminderDialog(item=null)' "$PAGE"
grep -q 'edit.onclick=()=>openReminderDialog(item)' "$PAGE"
# Verify the direct KCAPK entry point uses the same newly generated bundle.
cmp "$ROOT/web/app.bundle.js" "$ROOT/build/web/app.bundle.js"
if grep -q 'id="reminder-new"' "$PAGE"; then
    echo 'Duplicate header detected in packaged UI' >&2
    exit 1
fi
if grep -q 'id="reminder-new"' "$PAGE"; then
    echo 'Duplicate reminder add control was generated' >&2
    exit 1
fi
grep -q 'i-toilet' "$PAGE"
grep -q 'i-vape' "$PAGE"
grep -q 'i-glass' "$PAGE"
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
    node - "$ROOT" <<'NODE'
const fs=require("fs"), root=process.argv[2];
const file=fs.readFileSync(root+"/web/classifier.js","utf8").replace("export function suggestCategory","function suggestCategory");
const categorize=new Function(file+"; return suggestCategory")();
const examples=[
 ["Fui al baño","Ir al baño"],["Hice pis","Ir al baño"],["Evacué","Ir al baño"],
 ["Me bañé","Higiene"],["Me duché","Higiene"],
 ["Fumé un cigarrillo","Tabaco"],["Vapeé","Vapeo"],["Usé el cigarrillo electrónico","Vapeo"],
 ["Tomé una cerveza","Alcohol"],["Tomé agua","Hidratación"],["Tomé café","Cafeína"],["Tomé una pastilla","Medicación"]
];
for(const [sentence,expected] of examples){
 const actual=categorize(sentence,[])?.category;
 if(actual!==expected)throw Error(sentence+": expected "+expected+", got "+actual);
}
NODE
fi
echo 'Packaged WebView HTML smoke test passed'
