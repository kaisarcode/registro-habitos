#!/bin/sh
# Prepare a deployable static demo from the same assets used by the APK.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEST="$ROOT/demo/dist"
sh "$ROOT/build.sh" --prepare-only
rm -rf "$DEST"
mkdir -p "$DEST/app"
cp -R "$ROOT/.build/web/." "$DEST/app/"
cp "$ROOT/demo/index.html" "$ROOT/demo/demo.css" "$ROOT/demo/stubs.js" "$DEST/"
# Load the demo bridge before the bundled app code. Never patch application source.
awk '
    /^[[:space:]]*<script>$/ && !inserted {
        print "  <script src=\"../stubs.js\"></script>"
        inserted=1
    }
    {print}
    END {if(!inserted)exit 1}
' "$DEST/app/index.html" > "$DEST/app/index.tmp.html"
mv "$DEST/app/index.tmp.html" "$DEST/app/index.html"
printf 'Static demo prepared in: %s\n' "$DEST"
printf '%s\n' 'Upload the CONTENTS of demo/dist/ to your web server.'
