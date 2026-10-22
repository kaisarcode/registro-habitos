# registro-habitos agent instructions

Work on the existing `slave` branch. Do not modify the separate `kcapk` or `kclib` repositories when changing this app.

Follow KaisarCode composition-first conventions: each capability is independent; UI, persistence, categorization, alarms, voice capture and export are separate operations with explicit contracts. Reuse existing kclibs without making them depend on each other. Keep original entry text, timestamps and user corrections authoritative. Never block capture on categorization.

KCAPK is an external build dependency, not a vendored library. The app's `build.sh` invokes it through `KCAPK_DIR`. Never claim WebView storage is SQLite. Document which capabilities are implemented and which require native integration. Preserve the dark, low-stimulation interface and don't introduce unsolicited reminders, prealerts, animations or streaks.

User-visible text is Spanish. Code and developer documentation may be English.
