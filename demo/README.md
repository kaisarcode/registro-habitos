# Registro de Hábitos demo

Open `demo/index.html` in a browser. The phone preview loads the same web interface as the Android app from `demo/app/`; no build step is needed.

The `demo/` folder is also deployable as-is: upload it to any static web server. All paths are relative, so publishing under a subdirectory works.

`demo/app/` contains a snapshot of the application's web assets and a JavaScript bundle assembled from the same source modules used by `build.sh`. The only browser-specific modification to the app HTML is loading `../stubs.js` before the application bundle.

Records created in the demo stay in the browser's own IndexedDB. Existing Android data is not accessed or modified. Android alarms and notifications are simulated rather than actually scheduled. Dictation follows the existing browser SpeechRecognition fallback when supported.

To update the demo after changing application source files, regenerate its snapshot from the current `src/web/` modules and assets and commit the updated files. There is no runtime build requirement. For best browser storage compatibility, serve the folder over HTTP(S); `file://` restrictions can vary by browser.

The application is licensed under GNU LGPLv3.
