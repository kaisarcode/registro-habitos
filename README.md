# Registro de Hábitos

Registro de Hábitos is an Android habit and activity journal designed for quick, optional daily logging. Record an activity by choosing a category, writing, or using voice input; review your history, set reminders, and export your own data.

Entries are stored locally. The app does not require an account or a backend.

## Features

- Quick entry creation and editing, including optional mood, energy, notes, start time, and duration.
- Custom categories with searchable names, keywords, colors, icons, and optional images.
- Date-grouped history with text and date filters and progressive loading.
- Weekly, monthly, and yearly summaries.
- Android reminders with optional notification sounds.
- Backup, restore, and analysis export.
- Dark and light themes, English and Spanish interface, and reduced-motion support.

## Build

This repository contains the application. [KCAPK](https://github.com/kaisarcode/kcapk) is its external Android builder.

Place the repositories alongside each other, or point `KCAPK_DIR` at an existing KCAPK checkout. Then run:

```sh
KCAPK_DIR=../kcapk ./build.sh
```

The resulting APK is `bin/registro-habitos.apk`. Android build tools and other host requirements are documented in [KCAPK's building guide](https://github.com/kaisarcode/kcapk/blob/slave/doc/BUILDING.md).

To prepare the bundled web interface without building an APK:

```sh
./build.sh --prepare-only
```

This produces `.build/web/index.html`. The source template in `src/web/index.html` is not a standalone runnable page.

## Documentation

- [Using the application](doc/USAGE.md): entries, categories, history, summaries, reminders, and settings.
- [Building and installing](doc/BUILDING.md): KCAPK integration, APK output, installation, and local preview.
- [Data and privacy](doc/DATA.md): local storage, backup and restore, exported data, and limitations.
- [Architecture](doc/ARCHITECTURE.md): web modules, Android extensions, and source ownership.

## Privacy

The app keeps entries on the device and does not provide cloud sync or telemetry. Backups and exports may contain sensitive information. Voice recognition uses the Android speech service or an available browser recognizer, which may require a network connection and may process audio externally. See [Data and privacy](doc/DATA.md).

## License

[![LGPLv3](https://www.gnu.org/graphics/lgplv3-147x51.png)](https://www.gnu.org/licenses/lgpl-3.0.html)

This project is distributed under the **GNU Lesser General Public License version 3 (LGPLv3)**.
