# registro-habitos

Registro personal de actividades y estados para seguimiento cotidiano y terapia ocupacional. La prioridad es registrar algo en segundos: tocar, hablar o escribir, guardar; clasificar después.

## Ejecutar la interfaz

Abrir `web/index.html` en un navegador moderno. `build-app.sh` genera `build/web/index.html` con JavaScript clásico **inline**, siguiendo el patrón funcional de `kcapk/tests/index.html`. La fuente sigue separada en módulos mantenibles; el APK no usa imports de ES modules desde `file:///android_asset/`. Es una primera versión funcional de captura, historial, edición, búsqueda, sugerencias de categorías y exportación CSV/JSON e importación de respaldos JSON. Funciona sin servidor y utiliza **IndexedDB** como almacenamiento local principal. No hace falta SQLite para el uso previsto.

El dictado solo se habilita si el motor del WebView expone reconocimiento local (`processLocally`). No se utiliza reconocimiento remoto ni una API web externa; si no hay motor local, escribir sigue funcionando.

## Comprobación rápida\n\n```sh\nsh ./tests/test.sh\n```\n\nEsto genera la misma página HTML local que se empaquetará y comprueba sus controles y JavaScript (también su sintaxis cuando Node está instalado). No sustituye una prueba manual del APK en Android.\n\n## Construir con KCAPK externo

```sh
KCAPK_DIR=../kcapk ./build-app.sh
```

`build-app.sh` delega la generación de Android a KCAPK; no copia, modifica ni incorpora sus fuentes. KCAPK debe estar instalado con su cadena de compilación Android.

## Arquitectura

- `web/app.js`: presentación, interacción y captura sin bloquearse por categorías.
- `web/storage.js`: contrato de almacenamiento (actualmente IndexedDB; reemplazable por SQLite).
- `web/classifier.js`: sugerencias reproducibles a partir del historial, con prioridad a correcciones manuales; no modifica datos silenciosamente.
- `web/index.html` y `web/style.css`: vista oscura mobile-first.
- `build-app.sh`: integración con el builder externo de KCAPK.

Cada registro preserva fecha del evento, fecha de creación, texto original, categoría opcional, energía y bienestar opcionales (0–10). Los datos no se sincronizan. La exportación sólo ocurre a pedido.

## Integración nativa prevista

La aplicación conserva IndexedDB. El JSON versionado contiene las entradas completas con sus campos originales y es el formato de respaldo e intercambio; el CSV está orientado al análisis externo. La importación JSON valida el archivo completo y agrega solamente identificadores nuevos, sin modificar registros existentes. Exportar el JSON y guardarlo fuera del dispositivo es importante porque borrar los datos de la aplicación puede eliminar IndexedDB. KCAPK también ofrece `--api alarms` y `--api notifications`, pero la reproducción de MP3 propios en notificaciones nativas todavía requiere una integración específica.

Para la categorización, comenzar con precedentes y perfiles de texto. `libtpm.c` permite medir similitud de textos; `libemb.c` genera embeddings locales (modelo BGE small **en inglés**), y `libhnsw.c` indexa vectores. Ninguno debe bloquear la creación de registros.

### Clasificación por idioma

`liblng.c` ofrece detección local sin estado y resultados ordenados por puntuación heurística (no probabilidades). La composición nativa prevista es: detectar idioma → consultar el perfil de ese idioma → sugerir categoría mediante precedentes/`libtpm.c` y, opcionalmente, `libemb.c` + `libhnsw.c`. Mantener índices y perfiles separados por idioma, versión de modelo y perfil de usuario. Si no se detecta idioma con seguridad, conservar el idioma como desconocido y guardar de todos modos. Los textos cortos son especialmente ambiguos.

`web/classifier.js` ya acepta un código de idioma y evita mezclar precedentes con idiomas distintos cuando ambos están identificados. **La conexión real con `liblng.c` aún no está implementada**; por ahora las reglas locales corresponden a español. El modelo BGE disponible en `libemb.c` está entrenado para inglés: puede evaluarse sobre español, sin suponer resultados equivalentes ni traducir automáticamente datos sensibles.

## Intercambio de datos

El botón **Exportar JSON** produce un respaldo con `version`, `exportedAt` y `entries`. **Importar JSON** acepta ese mismo formato y combina las entradas por su ID, conservando las existentes sin reemplazarlas. La importación es transaccional: si falla, no confirma parcialmente la importación. **Exportar CSV** es una vista tabular para análisis y no se utiliza para restaurar, porque no representa necesariamente futuros campos anidados. La exportación no está filtrada por la búsqueda actual: incluye todos los registros.

## Interfaz, recursos y modo sin conexión

Todo el HTML, CSS, JavaScript y el icono SVG se empaquetan localmente, sin CDN ni dependencias de red en ejecución. `build-app.sh` configura `assets/icon.svg` como icono del launcher, con espacio de seguridad para máscaras adaptativas. Se conserva el diseño oscuro, el botón principal grande, los detalles opcionales y una sección independiente para recordatorios. Los recordatorios se guardan en `localStorage` y se incluyen en el JSON de respaldo, pero importar el JSON **no** programa alarmas automáticamente. Las alarmas nativas necesitan permisos de notificación y, para recordatorios diarios, se programan con una ventana de 28 días.

## Privacidad

La información puede contener datos sensibles: se mantiene local, sin telemetría ni backend. Una exportación genera un archivo legible por terceros; compartilo sólo cuando lo decidas.
