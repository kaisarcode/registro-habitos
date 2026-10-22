#!/bin/sh
# Build the app without copying or modifying KCAPK.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
KCAPK_DIR=${KCAPK_DIR:-"$ROOT/../kcapk"}
PREPARE_ONLY=false
if [ "${1:-}" = "--prepare-only" ]; then
    PREPARE_ONLY=true
    shift
fi

WEB_OUT="$ROOT/build/web"
mkdir -p "$WEB_OUT"
cp -R "$ROOT/web/." "$WEB_OUT/"
# The KCAPK integration test uses classic, inline JavaScript in a local HTML
# page. Match that tested loading pattern instead of using ES modules from file:.
{
    printf '%s\n' '// Classic WebView bundle'
    sed 's/^export const storage =/const storage =/' "$ROOT/web/storage.js"
    sed 's/^export function suggestCategory/function suggestCategory/' "$ROOT/web/classifier.js"
    cat "$ROOT/web/reminders.js"
    sed '/^import /d' "$ROOT/web/app.js"
} > "$WEB_OUT/app.bundle.js"
# Keep the source template useful in browsers, but package a single inline
# script in the APK so startup cannot depend on a secondary JS file load.
awk -v bundle="$WEB_OUT/app.bundle.js" '
    /<script defer src="\.\/app\.bundle\.js"><\/script>/ {
        print "  <script>"
        while ((getline line < bundle) > 0) print line
        close(bundle)
        print "  </script>"
        found = 1
        next
    }
    { print }
    END { if (!found) exit 1 }
' "$ROOT/web/index.html" > "$WEB_OUT/index.html"

if [ "$PREPARE_ONLY" = true ]; then
    printf 'Prepared local WebView page: %s\n' "$WEB_OUT/index.html"
    exit 0
fi
if [ ! -f "$KCAPK_DIR/build.sh" ]; then
    printf '%s\n' "KCAPK not found: $KCAPK_DIR/build.sh (set KCAPK_DIR)" >&2
    exit 1
fi
cd "$KCAPK_DIR"
exec sh ./build.sh \
    --display-name "Registro Hábitos" \
    --project-name registro-habitos \
    --package-name com.kaisarcode.registrohabitos \
    --webview-url "$WEB_OUT/index.html" \
    --output-path "$ROOT/build/android" \
    --background '#151a20' \
    --icon "$ROOT/assets/icon.svg" \
    --icon-background '#102a30' \
    --api alarms \
    --api notifications \
    --api permissions \
    --api files \
    --api intents \
    --permission notifications \
    --permission microphone \
    "$@"
