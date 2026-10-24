# Registro de Hábitos demo

Open `demo/index.html` to see the application inside a phone-sized frame. The frame uses `demo/app/index.html`, with the same WebView assets and application logic as the APK.

The repository's main `build.sh` refreshes `demo/app/` **on every run**, including `sh build.sh --prepare-only`. There is no separate demo build script. The generated page only adds `../stubs.js` before the application's bundled code; the actual APK build is unchanged.

To publish the demo, upload the entire `demo/` directory to any static server. Paths are relative, so subdirectories are supported. For reliable browser storage, use HTTP(S); `file://` restrictions vary.

Demo entries use browser-local IndexedDB, not Android data. Android alarms and notifications are simulated; browser dictation uses the existing SpeechRecognition fallback when supported.

The application is licensed under GNU LGPLv3.
