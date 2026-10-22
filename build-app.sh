#!/bin/sh
# KCAPK is an external build tool, never copied into this repository.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
KCAPK_DIR=${KCAPK_DIR:-"$ROOT/../kcapk"}
if [ ! -f "$KCAPK_DIR/build.sh" ]; then
    printf '%s\n' "KCAPK not found: $KCAPK_DIR/build.sh (set KCAPK_DIR)" >&2
    exit 1
fi
mkdir -p "$ROOT/build"
cd "$KCAPK_DIR"
exec sh ./build.sh \
    --display-name "Registro Hábitos" \
    --project-name registro-habitos \
    --package-name com.kaisarcode.registrohabitos \
    --webview-url "$ROOT/web/index.html" \
    --output-path "$ROOT/build/android" \
    --background '#151a20' \
    --api alarms \
    --api notifications \
    --api permissions \
    --api files \
    --api intents \
    --permission notifications \
    --permission microphone \
    "$@"
