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
# Never carry stale assets from an earlier build into the new APK.
# build/web is generated output, not a source directory.
rm -rf "$WEB_OUT"
mkdir -p "$WEB_OUT"
cp -R "$ROOT/web/." "$WEB_OUT/"
# The KCAPK integration test uses classic, inline JavaScript in a local HTML
# page. Match that tested loading pattern instead of using ES modules from file:.
# Regenerate the source bundle as well: direct KCAPK builds pointing at
# web/index.html must never package a stale JavaScript file.
{
    printf '%s\n' '// Generated bundle from storage, classifier, reminders and app modules.'
    sed 's/^export const storage =/const storage =/' "$ROOT/web/storage.js"
    sed 's/^export function suggestCategory/function suggestCategory/' "$ROOT/web/classifier.js"
    cat "$ROOT/web/reminders.js"
    cat "$ROOT/web/backup-zip.js"
    sed 's/^export const ICON_NAMES/const ICON_NAMES/;s/^export const categoryStore/const categoryStore/' "$ROOT/web/categories.js"
    sed '/^import /d' "$ROOT/web/app.js"
} > "$ROOT/web/app.bundle.js"
cp "$ROOT/web/app.bundle.js" "$WEB_OUT/app.bundle.js"
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
' "$ROOT/web/index.html" > "$WEB_OUT/app.html"
# Embed the commit ID and use a monotonically increasing Android versionCode.
# Reusing the same versionCode across many APK updates makes device diagnosis
# difficult and can result in stale copies being installed. The version code is
# independent of timestamps and increases with commits on slave.
APP_BUILD=$(git -C "$ROOT" rev-parse --short=10 HEAD 2>/dev/null || printf 'local')
APP_VERSION="0.3.2"
VERSION_CODE=20261027
VERSION_BASE_COMMIT=45101558a0541ac69f3454efaae6bfe07f5fe6f4
if git -C "$ROOT" cat-file -e "$VERSION_BASE_COMMIT^{commit}" 2>/dev/null; then
    VERSION_INCREMENT=$(git -C "$ROOT" rev-list --count "$VERSION_BASE_COMMIT..HEAD")
    VERSION_CODE=$((20261026 + VERSION_INCREMENT))
fi
printf 'APK versionCode: %s (source %s)\n' "$VERSION_CODE" "$APP_BUILD"
sed -e "s/@APP_BUILD@/$APP_BUILD/g" -e "s/@APP_VERSION_CODE@/$VERSION_CODE/g" -e "s/@APP_VERSION@/$APP_VERSION/g" "$WEB_OUT/app.html" > "$WEB_OUT/app.versioned.html"
mv "$WEB_OUT/app.versioned.html" "$WEB_OUT/app.html"
printf 'Bundled app revision: %s\n' "$APP_BUILD"
# The original file:///android_asset/index.html can read older IndexedDB.
cp "$ROOT/web/migrate.html" "$WEB_OUT/index.html"

if [ "$PREPARE_ONLY" = true ]; then
    printf 'Prepared local WebView page: %s\n' "$WEB_OUT/index.html"
    exit 0
fi
if [ ! -f "$KCAPK_DIR/build.sh" ]; then
    printf '%s\n' "KCAPK not found: $KCAPK_DIR/build.sh (set KCAPK_DIR)" >&2
    exit 1
fi
# Stage only KCAPK's build sources and apply app-specific integration.
# The KCAPK repository itself is never changed.
KCAPK_STAGE="$ROOT/build/kcapk-voice"
mkdir -p "$KCAPK_STAGE"
rm -rf "$KCAPK_STAGE/src"
cp -R "$KCAPK_DIR/src" "$KCAPK_STAGE/src"
cp "$KCAPK_DIR/build.sh" "$KCAPK_STAGE/build.sh"
cp "$ROOT/native/AppWebChromeClient.java.in" "$KCAPK_STAGE/src/templates/java/"
cp "$ROOT/native/AppNavigationBridge.java.in" "$KCAPK_STAGE/src/templates/java/"
cp "$ROOT/native/AppDocumentBridge.java.in" "$KCAPK_STAGE/src/templates/java/"
cp "$ROOT/native/AppSoundPreview.java.in" "$KCAPK_STAGE/src/templates/java/"
cp "$ROOT/native/AlarmReceiver.java.in" "$KCAPK_STAGE/src/templates/java/AlarmReceiver.java.in"
# Include the user's quiet sounds as native Android resources so an alarm
# rings through a system notification even when the WebView is not running.
mkdir -p "$KCAPK_STAGE/src/templates/res/raw"
cp "$ROOT/web/sounds/glock.mp3" "$KCAPK_STAGE/src/templates/res/raw/registro_glock.mp3"
cp "$ROOT/web/sounds/alert.mp3" "$KCAPK_STAGE/src/templates/res/raw/registro_alert.mp3"
python3 "$ROOT/scripts/patch-kcapk.py" "$KCAPK_STAGE/src/templates/java"
cd "$KCAPK_STAGE"
sh ./build.sh \
    --display-name "Registro Hábitos" \
    --project-name registro-habitos \
    --package-name com.kaisarcode.registrohabitos \
    --webview-url "$WEB_OUT/index.html" \
    --output-path "$ROOT/build/android" \
    --background '#151a20' \
    --version-code "$VERSION_CODE" \
    --version-name "$APP_VERSION" \
    --icon "$ROOT/assets/icon.svg" \
    --icon-background '#102a30' \
    --api alarms \
    --api notifications \
    --api permissions \
    --api files \
    --api intents \
    --api clipboard \
    --permission notifications \
    --permission exactAlarm \
    --permission microphone \
    --trusted-origin https://appassets.androidplatform.net \
    "$@"

APK_BUILT="$ROOT/build/android/bin/registro-habitos.apk"
APK_OUTPUT="$ROOT/registro-habitos.apk"
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
cp "$APK_BUILT" "$APK_OUTPUT"
printf 'APK: %s\n' "$APK_OUTPUT"
wc -c < "$APK_OUTPUT" | awk '{printf "APK size: %s bytes\n", $1}'
printf '%s\n' 'Signing: KCAPK uses ~/.android/debug.keystore; keep the same keystore for updates.'
