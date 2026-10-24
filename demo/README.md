# Registro de Hábitos web demo

The demo uses the same generated HTML, CSS, JavaScript, icons, and other web assets as the Android APK. The only additions are an iframe-based phone preview and browser stubs for Android capabilities.

## Build

From the repository root:

```sh
sh demo/build.sh
```

The command first runs the application's existing `build.sh --prepare-only` path, then creates a self-contained `demo/dist/` directory. It does not require an Android SDK or KCAPK checkout.

## Preview locally

Serve the generated directory over HTTP:

```sh
cd demo/dist
python3 -m http.server 8080
```

Open [the local demo](http://localhost:8080) in a browser.

## Deploy

Upload the contents of `demo/dist/` to the desired directory on your web server. The iframe and all assets use relative URLs, so the demo also works under a subdirectory.

## Behavior and limitations

Entry creation, categories, history, preferences, and browser-local IndexedDB storage run using the real application code. Demo data is confined to the browser's origin and may persist between visits.

Android alarms and notifications are simulated in memory. They do not generate system notifications or trigger scheduled reminders. Native voice recognition is absent in the demo, so the application uses its existing browser \`SpeechRecognition\` or \`webkitSpeechRecognition\` fallback when supported. Browser dictation may require microphone permission, network access, or an available speech service. These stubs are for interface demonstration only, not for validating Android-specific behavior.

The `demo/dist/` directory is generated output. Re-run the build command after changing the application sources.

## License

[![LGPLv3](https://www.gnu.org/graphics/lgplv3-147x51.png)](https://www.gnu.org/licenses/lgpl-3.0.html)

This project is distributed under the **GNU Lesser General Public License version 3 (LGPLv3)**.
