# registro-habitos

Registro personal de actividades y estados para seguimiento cotidiano y terapia ocupacional. La prioridad es registrar algo en segundos: tocar, hablar o escribir, guardar; clasificar después.

## Ejecutar la interfaz

Abrir `web/index.html` en un navegador moderno. Es una primera versión funcional de captura, historial, edición, búsqueda, sugerencias de categorías y exportación CSV/JSON. Funciona sin servidor y utiliza **IndexedDB temporalmente**. **Todavía no es SQLite**: la integración nativa y exportación de una base SQLite real son tareas pendientes.

El dictado usa el motor de reconocimiento de voz disponible en el navegador/WebView; puede no estar disponible o requerir un servicio externo. Siempre es posible escribir.

## Construir con KCAPK externo

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

El siguiente incremento incorpora SQLite real detrás del adaptador, así como importación y copia del archivo `.sqlite`. KCAPK puede empaquetar una utilidad compilada aparte mediante `--exec`; eso requiere resolver dónde vive el archivo persistente y el protocolo de acceso. También ofrece `--api alarms` y `--api notifications`, pero hay que verificar cómo entregar los sonidos MP3 personalizados en las notificaciones nativas.

Para la categorización, comenzar con precedentes y perfiles de texto. `libtpm.c` permite medir similitud de textos; `libemb.c` genera embeddings locales (modelo BGE small **en inglés**), y `libhnsw.c` indexa vectores. Ninguno debe bloquear la creación de registros.

### Clasificación por idioma

`liblng.c` ofrece detección local sin estado y resultados ordenados por puntuación heurística (no probabilidades). La composición nativa prevista es: detectar idioma → consultar el perfil de ese idioma → sugerir categoría mediante precedentes/`libtpm.c` y, opcionalmente, `libemb.c` + `libhnsw.c`. Mantener índices y perfiles separados por idioma, versión de modelo y perfil de usuario. Si no se detecta idioma con seguridad, conservar el idioma como desconocido y guardar de todos modos. Los textos cortos son especialmente ambiguos.

`web/classifier.js` ya acepta un código de idioma y evita mezclar precedentes con idiomas distintos cuando ambos están identificados. **La conexión real con `liblng.c` aún no está implementada**; por ahora las reglas locales corresponden a español. El modelo BGE disponible en `libemb.c` está entrenado para inglés: puede evaluarse sobre español, sin suponer resultados equivalentes ni traducir automáticamente datos sensibles.

## Privacidad

La información puede contener datos sensibles: se mantiene local, sin telemetría ni backend. Una exportación genera un archivo legible por terceros; compartilo sólo cuando lo decidas.
