# registro-habitos

Registro personal de actividades y estados para seguimiento cotidiano y terapia ocupacional. La prioridad es registrar algo en segundos: tocar, hablar o escribir, guardar; clasificar después.

## Ejecutar la interfaz

Abrir `web/index.html` en un navegador moderno. `build.sh` genera `build/web/app.html` con JavaScript clásico **inline**, siguiendo el patrón funcional de `kcapk/tests/index.html`. La fuente sigue separada en módulos mantenibles; el APK no usa imports de ES modules desde `file:///android_asset/`. La app implementa el diseño móvil con captura rápida, historial, edición, categorías, resumen gráfico por período, recordatorios, opciones y exportación/importación JSON/CSV. Funciona sin servidor y utiliza **IndexedDB** como almacenamiento local principal. No hace falta SQLite para el uso previsto.

El dictado utiliza `SpeechRecognition` o `webkitSpeechRecognition` del navegador/WebView. En Android solicita primero el permiso de micrófono mediante `NativeBridge.Android.permissions`. La compatibilidad depende del WebView y del motor de voz instalado; si no existe, la escritura sigue funcionando. **El motor de voz del navegador puede enviar audio a un servicio remoto y requerir conexión**. La aplicación no envía audio por su cuenta ni utiliza servicios propios, pero el dictado no está garantizado como offline.

## Comprobación rápida\n\n```sh\nsh ./tests/test.sh\n```\n\nEsto genera la misma página HTML local que se empaquetará y comprueba sus controles y JavaScript (también su sintaxis cuando Node está instalado). No sustituye una prueba manual del APK en Android.\n\n## Construir con KCAPK externo

```sh
KCAPK_DIR=../kcapk ./build.sh
```

`build.sh` usa la instalación externa de KCAPK. Copia temporalmente sus templates a `build/kcapk-voice/` y aplica allí un parche específico para el micrófono y los recursos locales; **no modifica el repositorio de KCAPK**. KCAPK debe estar instalado con su cadena de compilación Android. `python3` es necesario solamente al compilar para aplicar ese parche.

La compilación deja el resultado en **`registro-habitos.apk`**, directamente en la raíz del proyecto. Los archivos intermedios quedan en `build/`. El APK generado no se versiona en Git.

## Voz del navegador y migración de datos

KCAPK original no instala un `WebChromeClient` con `onPermissionRequest`, por lo que Android WebView puede denegar el micrófono aun después de autorizar `RECORD_AUDIO` para la aplicación. Esta app configura un `AppWebChromeClient` que concede exclusivamente `RESOURCE_AUDIO_CAPTURE` a la página empaquetada y sólo cuando Android ya concedió `RECORD_AUDIO`. No concede permisos adicionales ni a otros orígenes.

Para que `SpeechRecognition` no opere desde `file://`, la página real se carga bajo `https://appassets.androidplatform.net/app.html`, un **origen HTTPS local servido desde los assets del APK**, sin solicitud de red para HTML/CSS/JS/MP3. El primer arranque sigue usando `file:///android_asset/index.html` a fin de migrar registros anteriores desde IndexedDB a la nueva ubicación mediante mensajes entre las dos páginas internas. Si la migración falla, no borra los datos antiguos y muestra una opción para continuar. Se conserva el mismo package Android.

Este cambio corrige la configuración de permisos y origen del WebView. La disponibilidad efectiva del reconocimiento sigue dependiendo de la implementación de Web Speech y del servicio de voz del dispositivo. **No se ha verificado en un teléfono real**.

## Arquitectura

- `web/app.js`: presentación, interacción y captura sin bloquearse por categorías.
- `web/storage.js`: contrato de almacenamiento (actualmente IndexedDB; reemplazable por SQLite).
- `web/classifier.js`: sugerencias reproducibles a partir del historial, con prioridad a correcciones manuales; no modifica datos silenciosamente.
- `web/index.html` y `web/style.css`: vista oscura mobile-first.
- `build.sh`: integración con el builder externo de KCAPK.

Cada registro preserva fecha del evento, fecha de creación, texto original, categoría opcional, energía y bienestar opcionales (0–10). Los datos no se sincronizan. La exportación sólo ocurre a pedido.

## Integración nativa prevista

La aplicación conserva IndexedDB. El JSON versionado contiene las entradas completas con sus campos originales y es el formato de respaldo e intercambio; el CSV está orientado al análisis externo. La importación JSON valida el archivo completo y agrega solamente identificadores nuevos, sin modificar registros existentes. Exportar el JSON y guardarlo fuera del dispositivo es importante porque borrar los datos de la aplicación puede eliminar IndexedDB. KCAPK ofrece `--api alarms` y `--api notifications`, usados para entregar alertas nativas y sus audios empaquetados.

Para la categorización, comenzar con precedentes y perfiles de texto. `libtpm.c` permite medir similitud de textos; `libemb.c` genera embeddings locales (modelo BGE small **en inglés**), y `libhnsw.c` indexa vectores. Ninguno debe bloquear la creación de registros.

### Clasificación por idioma

`liblng.c` ofrece detección local sin estado y resultados ordenados por puntuación heurística (no probabilidades). La composición nativa prevista es: detectar idioma → consultar el perfil de ese idioma → sugerir categoría mediante precedentes/`libtpm.c` y, opcionalmente, `libemb.c` + `libhnsw.c`. Mantener índices y perfiles separados por idioma, versión de modelo y perfil de usuario. Si no se detecta idioma con seguridad, conservar el idioma como desconocido y guardar de todos modos. Los textos cortos son especialmente ambiguos.

`web/classifier.js` ya acepta un código de idioma y evita mezclar precedentes con idiomas distintos cuando ambos están identificados. **La conexión real con `liblng.c` aún no está implementada**; por ahora las reglas locales corresponden a español. El modelo BGE disponible en `libemb.c` está entrenado para inglés: puede evaluarse sobre español, sin suponer resultados equivalentes ni traducir automáticamente datos sensibles.

## Intercambio de datos

El botón **Exportar JSON** produce un respaldo con `version`, `exportedAt` y `entries`. **Importar JSON** acepta ese mismo formato y combina las entradas por su ID, conservando las existentes sin reemplazarlas. La importación es transaccional: si falla, no confirma parcialmente la importación. **Exportar CSV** es una vista tabular para análisis y no se utiliza para restaurar, porque no representa necesariamente futuros campos anidados. La exportación no está filtrada por la búsqueda actual: incluye todos los registros.

## Interfaz, recursos y modo sin conexión

Todo el HTML, CSS, JavaScript y el icono SVG se empaquetan localmente, sin CDN ni dependencias de red en ejecución. `build.sh` configura `assets/icon.svg` como icono del launcher, con espacio de seguridad para máscaras adaptativas. Se conserva el diseño oscuro, el botón principal grande, los detalles opcionales y una sección independiente para recordatorios. Los recordatorios se guardan en `localStorage` y se incluyen en el JSON de respaldo. Al importar, las alarmas se vuelven a programar sólo con confirmación explícita. Las alarmas nativas necesitan permisos de notificación. El APK solicita el permiso especial **Alarmas y recordatorios** cuando el usuario crea o activa un recordatorio, si Android lo requiere. El receptor nativo programa el siguiente evento diario o de días hábiles después de cada entrega, independientemente del WebView, sin una ventana limitada a 28 días.

## Límites de integración Android

- La app no carga librerías, CDN ni recursos externos. El dictado depende del motor del navegador y puede requerir conexión externa; el registro escrito y el resto de la aplicación siguen disponibles offline.
- Los dos MP3 suministrados se incluyen como archivos web para vista previa y como recursos `res/raw` de Android para las **notificaciones del sistema**; la alarma se entrega desde `AlarmReceiver`, aunque el WebView esté cerrado. Se usan canales separados con importancia predeterminada para cada sonido, evitando canales silenciosos de versiones anteriores. El volumen final depende del canal de notificaciones y los ajustes de Android. El botón **Probar notificación del sistema** permite comprobar el permiso, el canal y el sonido en el dispositivo; el botón **Escuchar audio** solo prueba el archivo web.
- En Android, `kcapk` ofrece `intents.share` y `clipboard`: los botones de exportación permiten compartir texto JSON/CSV. El importador soporta JSON pegado o tomado del portapapeles. La selección directa de archivo puede depender del soporte del WebView.
- La interfaz se aproxima a la referencia gráfica; las fuentes y el renderizado varían con el dispositivo. No se ha validado aquí en un Android físico.

## Privacidad

La información puede contener datos sensibles: se mantiene local, sin telemetría ni backend. Una exportación genera un archivo legible por terceros; compartilo sólo cuando lo decidas.

## Comprobación de versión del APK

La pantalla **Más** muestra la **Versión de interfaz** del commit empaquetado. El generador actualiza `web/app.bundle.js` para que compilaciones directas de `web/index.html` no usen un script viejo y empaqueta el HTML inline desde `build/web/app.html`. El overlay de Android usa `LOAD_NO_CACHE`, limpia únicamente la caché de recursos (sin borrar IndexedDB) y devuelve `Cache-Control: no-store` para los assets locales. El APK incrementa `versionCode` a `20261022`.

Si Recordatorios sigue mostrando dos títulos y el botón de tres puntos elimina, la instalación todavía contiene una versión anterior: desde este commit la fuente usa un único encabezado y un botón de edición `✎`. Verificá la versión en **Más** y que la compilación se haga desde `slave` y con el nuevo `build.sh`. No desinstales ni borres datos para resolverlo.

## Registro corporal y consumo

Categorías disponibles: **Ir al baño**, **Tabaco**, **Vapeo**, **Alcohol**, **Higiene**, **Medicación** y **Cafeína**, además de las actividades habituales. El clasificador local reconoce frases naturales como “fui al baño”, “hice pis”, “fumé un cigarrillo”, “vapeé” o “tomé cerveza”. Guardar sigue siendo inmediato; ninguna medición adicional es obligatoria. Las categorías se pueden corregir desde Editar y los datos se exportan con las categorías elegidas. El registro rápido mantiene un máximo de seis sugerencias que se adaptan al historial.

## Inicio: registro por categorías y botón flotante

La vista **Mi día** presenta las categorías como botones permanentes. Tocar una categoría abre el formulario con esa categoría y una descripción sugerida ya seleccionadas; **Guardar** confirma la entrada con la fecha y hora actuales (editable). No se guarda nada antes de confirmar. **Deshacer** permite revertir la última entrada guardada. El botón flotante `+` abre un diálogo con texto, dictado del navegador y detalles opcionales (fecha, hora, categoría, energía, bienestar, duración, notas). Cerrar el diálogo no guarda nada. Los registros, clasificaciones, filtros y exportaciones existentes se mantienen sin migraciones de esquema.

## Duración opcional: minutos o inicio/fin

Al crear o editar una entrada se muestran **Horas** y **Minutos** directamente, sin selector de modo. Completar `4` horas y `0` minutos actualiza automáticamente un campo interno **oculto** con el total de `240` minutos, sin mostrar un tercer campo ni requerir edición manual. No se muestran los controles de inicio y fin. `duration` sigue almacenando minutos; los registros históricos con `startedAt` y `endedAt` mantienen esos datos para las exportaciones JSON y CSV.

## Botones del formulario

Los botones Cerrar y Guardar comparten dos columnas iguales y altura de 52 px. El margen superior antiguo de Guardar se eliminó.

## Diálogos de confirmación

Los mensajes de eliminación, creación de categorías, importación y errores utilizan un único diálogo propio, de colores oscuros y botones consistentes. No se emplean `window.alert`, `window.confirm` ni `window.prompt`. Los cambios destructivos siempre requieren confirmación. Los permisos nativos de Android siguen siendo ventanas del sistema operativo, no diálogos HTML.

## Recordatorios del sistema

Al compilar, `build.sh` incorpora `glock.mp3` y `alert.mp3` como recursos Android. El sonido de notificación se configura por canal independiente; se recomienda usar **Probar notificación del sistema** al instalar el nuevo APK y comprobar que Android permita las notificaciones y que el volumen esté activo. Los recordatorios elegidos como «Silencioso» siguen siendo silenciosos. Las alarmas usan exactitud cuando el dispositivo la autoriza, y de lo contrario una alarma compatible con reposo de Android que puede retrasarse. Los recordatorios futuros existentes se reprograman al abrir la app. No se garantiza entrega después de forzar la detención de la aplicación desde Ajustes.

## Prueba de recordatorios con la app cerrada

El botón **Probar con la app cerrada** programa una notificación del sistema de prueba a través de `AlarmBridge` y `AlarmReceiver`, para verificar la entrega sin WebView en ejecución. La app puede cerrarse normalmente, pero **Forzar detención** desde los ajustes de Android impide las alarmas hasta que se vuelva a iniciar. En Android 12+ y especialmente Android 14+, para minimizar retrasos es necesario habilitar el acceso especial **Alarmas y recordatorios** cuando el sistema lo solicita. Si no se concede, el APK utiliza `setAndAllowWhileIdle` (inexacta), que Android puede diferir en reposo. El `AlarmReceiver` propio reprograma de forma nativa los recordatorios diarios y de lunes a viernes, y `patch-kcapk.py` restaura repeticiones vencidas después de un reinicio o de conceder permisos. La prueba del botón tiene un intervalo corto y es deliberadamente iniciada por el usuario: no hay avisos anticipados en los recordatorios normales.

## Administrar categorías e íconos

La solapa **Categorías** es un administrador, no un lanzador de registros. Permite crear categorías y editar su nombre, palabras clave (separadas por comas o saltos de línea), color e ícono. Se incluye una selección consistente de **24 íconos Lucide (licencia ISC)** en el HTML del APK; no hay CDN ni dependencias de red. También podés elegir una foto o imagen PNG/JPG/WebP desde el celular: el selector de archivos se integra con el WebView de Android, la imagen se convierte localmente a WebP de 192×192 y se guarda con la configuración de la categoría. No se sube a internet.

El perfil se guarda en `localStorage` bajo `rh-category-profiles-v1`. La exportación JSON incluye `categoryProfiles`, incluidos los íconos personalizados codificados como datos; el CSV conserva los registros por nombre de categoría. Las palabras clave intervienen en la búsqueda y en la categorización automática local. Al renombrar una categoría, se actualizan sus registros asociados. Eliminarla la quita de la botonera y del administrador, **sin eliminar registros históricos**; los datos anteriores continúan accesibles desde Historial. Los nombres viejos almacenados en `rh-categories` siguen admitidos sin migración destructiva.

Licencia de terceros: `web/third-party/LUCIDE_LICENSE.txt`.
