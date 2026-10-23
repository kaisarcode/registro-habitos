# Building and installing

The Android package is built by [KCAPK](https://github.com/kaisarcode/kcapk). This project owns its web application, icon assets, and app-specific Java extensions; KCAPK owns the general Android build pipeline.

## Requirements

Use a local checkout of KCAPK that supports `--extension`, `--local-https-assets`, and the voice and alarm APIs. KCAPK's [building guide](https://github.com/kaisarcode/kcapk/blob/slave/doc/BUILDING.md) documents the Java JDK, Android SDK command-line tools, ImageMagick, and other host requirements.

The default directory arrangement is:

```text
workspace/
  kcapk/
  registro-habitos/
```

## Prepare the web application

From the `registro-habitos` directory:

```sh
./build.sh --prepare-only
```

The generated `.build/web/index.html` contains the bundled JavaScript. You can open it to inspect the web interface. The original `src/web/index.html` is a source template.

## Build the APK

```sh
KCAPK_DIR=../kcapk ./build.sh
```

The build assembles web assets and app-owned Java extensions under `.build/`, delegates Android packaging to KCAPK, and writes `bin/registro-habitos.apk`.

To use KCAPK from another directory, change `KCAPK_DIR` accordingly. Do not edit KCAPK templates to customize this application.

## Install on Android

With Android Debug Bridge and a connected device:

```sh
adb install -r bin/registro-habitos.apk
```

Keep the same signing key for updates. Replacing an installed app with an APK signed using a different key may require uninstalling it, which risks deleting its local data. Export a backup before any destructive installation operation.

## Packaged assets and permissions

The app packages its HTML, JavaScript, CSS, icons, and sounds locally. KCAPK serves bundled content through the secure `https://appassets.androidplatform.net/` origin using `--local-https-assets`.

The build enables the Android voice, alarm, notification, permission, file, intent, and clipboard bridges. Android-specific permissions depend on which features are used. Voice dictation may require an available speech service or network access.

See [Architecture](ARCHITECTURE.md) for the division between the web app, extensions, and KCAPK.
