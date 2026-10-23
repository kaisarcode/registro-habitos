# Data and privacy

Registro de Hábitos stores personal entries on the device. There is no account, cloud synchronization, or application telemetry.

## Local storage

Habit entries are stored in IndexedDB. Each entry can contain a description, occurrence time, category, optional mood and energy, optional start/end times and duration, and notes.

Categories, reminder preferences, and interface settings use browser-side local storage. Application data is not automatically synchronized between devices.

Clearing app data or uninstalling the app may remove local records. Keep an external backup if the records matter to you.

## Backup and restore

Use **Configuración** > **Respaldo y restauración** to export a backup and store it outside the application. The backup includes entry data and supported application settings. Restoration merges entries by their identifiers rather than overwriting existing entries.

After restoring reminders, Android notifications may need to be scheduled again and the app may ask for confirmation or system permissions.

## Analysis exports

Use **Configuración** > **Exportar para análisis** to produce a records-oriented export without unrelated application settings. Data exported from the application is readable outside it; review where you save or share it.

## Voice recognition

The native Android speech recognizer is preferred where supported, with browser speech recognition as a fallback. Speech recognition can depend on the installed speech engine and may transmit audio to an external provider. The app itself does not operate a voice-processing backend. Text entry works without speech recognition.

## Reminders

Reminders are scheduled through Android. Their delivery can be affected by notification permission, alarm access, battery management, and force-stop behavior. A reminder sound preview inside the app is not a guarantee that a system notification will be audible.

## Security considerations

The app does not encrypt exported backups. Treat files containing your entries as potentially sensitive and store or share them accordingly.

For build details, see [Building and installing](building.md).
