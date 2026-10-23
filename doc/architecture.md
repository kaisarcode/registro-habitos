# Architecture

Registro de Hábitos is a WebView-based Android application. App-specific behavior belongs to this repository; reusable Android build functionality belongs to KCAPK.

## Source ownership

- `src/web/index.html` and `src/web/style.css` define the interface.
- `src/web/app.js` coordinates navigation, forms, history, and rendering.
- `src/web/storage.js` owns IndexedDB entry persistence and paginated history queries.
- `src/web/categories.js` and `src/web/classifier.js` implement category profiles and local suggestions.
- `src/web/reminders.js` handles reminder configuration.
- `src/web/backup-zip.js` and the application export flows handle data interchange.
- `src/web/i18n.js` contains interface translations.
- `src/native/` owns Android extension sources for navigation, document handling, and sound preview.
- `src/assets/` owns the app icons and dark/light brand assets.
- `build.sh` prepares app assets and invokes KCAPK.

## Build boundary

The `build.sh` script creates `.build/web/` from the web source and includes the assembled JavaScript in the generated HTML. The same build prepares Android extension files under `.build/extension/`.

KCAPK packages the app with `--extension` and `--local-https-assets`. The result is copied to `bin/registro-habitos.apk`. Generated files are not part of the canonical `src/` tree.

KCAPK provides general Android bridges; this project does not patch or duplicate their Java templates.

## Runtime data flow

Entry creation and editing go through the web UI and IndexedDB storage. The home summary and full summary are projections of entry data; history queries use the IndexedDB `occurredAt` index to load matching records in bounded pages.

Category profiles and UI preferences remain app-local. Exporting data is explicitly initiated by the user. Reminders rely on Android scheduling so they can be delivered even when the WebView is not active, subject to system restrictions.

## Integration boundaries

This project does not implement a remote account or synchronization service. Its voice UI calls Android speech recognition where available and may fall back to browser capabilities. The Android speech engine, rather than this app, determines whether speech processing needs network access.

For KCAPK implementation and bridge contracts, consult the [KCAPK documentation](https://github.com/kaisarcode/kcapk/tree/slave/doc). For user-facing behavior, see [Using the application](usage.md).
