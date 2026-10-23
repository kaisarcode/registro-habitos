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

WEB_OUT="$ROOT/.build/web"
# Never carry stale assets from an earlier build into the new APK.
# build/web is generated output, not a source directory.
rm -rf "$WEB_OUT"
mkdir -p "$WEB_OUT"
cp -R "$ROOT/src/web/." "$WEB_OUT/"
cp "$ROOT/src/assets/icon.svg" "$WEB_OUT/icon.svg"
# The KCAPK integration test uses classic, inline JavaScript in a local HTML
# page. Match that tested loading pattern instead of using ES modules from file:.
# Bundle inside .build; source files must remain untouched.
{
    printf '%s\n' '// Generated bundle from storage, classifier, reminders and app modules.'
    sed 's/^export const storage =/const storage =/' "$ROOT/src/web/storage.js"
    sed 's/^export function suggestCategory/function suggestCategory/' "$ROOT/src/web/classifier.js"
    cat "$ROOT/src/web/reminders.js"
    cat "$ROOT/src/web/backup-zip.js"
    sed 's/^export const ICON_NAMES/const ICON_NAMES/;s/^export const categoryStore/const categoryStore/' "$ROOT/src/web/categories.js"
    sed '/^import /d' "$ROOT/src/web/app.js"
    cat "$ROOT/src/web/i18n.js"
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
' "$ROOT/src/web/index.html" > "$WEB_OUT/index.html"
# Embed the commit ID and use a monotonically increasing Android versionCode.
# Reusing the same versionCode across many APK updates makes device diagnosis
# difficult and can result in stale copies being installed. The version code is
# independent of timestamps and increases with commits on devel.
APP_BUILD=$(git -C "$ROOT" rev-parse --short=10 HEAD 2>/dev/null || printf 'local')
APP_VERSION="0.3.3"
VERSION_CODE=20261027
VERSION_BASE_COMMIT=45101558a0541ac69f3454efaae6bfe07f5fe6f4
if git -C "$ROOT" cat-file -e "$VERSION_BASE_COMMIT^{commit}" 2>/dev/null; then
    VERSION_INCREMENT=$(git -C "$ROOT" rev-list --count "$VERSION_BASE_COMMIT..HEAD")
    VERSION_CODE=$((20261026 + VERSION_INCREMENT))
fi
printf 'APK versionCode: %s (source %s)\n' "$VERSION_CODE" "$APP_BUILD"
sed -e "s/@APP_BUILD@/$APP_BUILD/g" -e "s/@APP_VERSION_CODE@/$VERSION_CODE/g" -e "s/@APP_VERSION@/$APP_VERSION/g" "$WEB_OUT/index.html" > "$WEB_OUT/index.versioned.html"
mv "$WEB_OUT/index.versioned.html" "$WEB_OUT/index.html"
printf 'Bundled app revision: %s\n' "$APP_BUILD"
if [ "$PREPARE_ONLY" = true ]; then
    printf 'Prepared local WebView page: %s\n' "$WEB_OUT/index.html"
    exit 0
fi
if [ ! -f "$KCAPK_DIR/build.sh" ]; then
    printf '%s\n' "KCAPK not found: $KCAPK_DIR/build.sh (set KCAPK_DIR)" >&2
    exit 1
fi
# Stage only application-owned native extensions, never KCAPK sources.
EXTENSION_OUT="$ROOT/.build/extension"
rm -rf "$EXTENSION_OUT"
mkdir -p "$EXTENSION_OUT/java" "$EXTENSION_OUT/res/raw"
cp "$ROOT/src/native/"*.java.in "$EXTENSION_OUT/java/"
cp "$ROOT/src/web/sounds/glock.mp3" "$EXTENSION_OUT/res/raw/registro_glock.mp3"
cp "$ROOT/src/web/sounds/alert.mp3" "$EXTENSION_OUT/res/raw/registro_alert.mp3"

sh "$KCAPK_DIR/build.sh" \
    --display-name "Registro de Hábitos" \
    --project-name registro-habitos \
    --package-name com.kaisarcode.registrohabitos \
    --webview-url "$WEB_OUT/index.html" \
    --output-path "$ROOT/.build/android" \
    --background '#151a20' \
    --version-code "$VERSION_CODE" \
    --version-name "$APP_VERSION" \
    --icon "$ROOT/src/assets/launcher-icon.svg" \
    --icon-background '#102a30' \
    --extension "$EXTENSION_OUT" \
    --local-https-assets \
    --api voice \
    --api alarms \
    --api notifications \
    --api permissions \
    --api files \
    --api intents \
    --api clipboard \
    --permission notifications \
    --permission exactAlarm \
    --permission microphone \
    "$@"

APK_BUILT="$ROOT/.build/android/bin/registro-habitos.apk"
APK_OUTPUT="$ROOT/bin/registro-habitos.apk"
if [ ! -s "$APK_BUILT" ]; then
    printf 'Error: KCAPK did not produce %s\n' "$APK_BUILT" >&2
    exit 1
fi
# Check that the actual output is a complete APK, rather than copying a
# partial or stale artifact with a .apk extension.
if ! unzip -tq "$APK_BUILT" >/dev/null; then
    printf 'Error: APK ZIP integrity check failed: %s\n' "$APK_BUILT" >&2
    exit 1
fi
if ! unzip -Z1 "$APK_BUILT" | grep -qx 'AndroidManifest.xml' ||
   ! unzip -Z1 "$APK_BUILT" | grep -qx 'classes.dex'; then
    printf 'Error: APK is missing its manifest or classes.dex\n' >&2
    exit 1
fi
mkdir -p "$ROOT/bin"
cp "$APK_BUILT" "$APK_OUTPUT"
printf 'APK: %s\n' "$APK_OUTPUT"
wc -c < "$APK_OUTPUT" | awk '{printf "APK size: %s bytes\n", $1}'
printf '%s\n' 'Signing: KCAPK uses ~/.android/debug.keystore; keep the same keystore for updates.'
