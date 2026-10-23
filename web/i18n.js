// Offline UI localization. Data values, saved descriptions, and IDs are never modified.
const RH_TRANSLATIONS={"Registro de Hábitos":"Habit Tracker","Nuevo registro":"New Entry","Elige una categoría para completar y guardar tu entrada.":"Choose a category to complete and save your entry.","Hoy":"Today","registros":"entries","registro":"entry","Deshacer":"Undo","Categorías":"Categories","Edita nombres, palabras clave e íconos. Los registros anteriores se conservan.":"Edit names, keywords and icons. Previous entries are preserved.","Semana":"Week","Mes":"Month","Año":"Year","Nuevo recordatorio":"New Reminder","Nombre":"Name","Horarios del día":"Times of Day","+ Agregar horario":"+ Add Time","Frecuencia":"Frequency","Todos los días":"Every Day","Días de semana":"Weekdays","Una vez":"Once","Sonido":"Sound","Glockenspiel":"Glockenspiel","Notificación suave":"Soft Notification","Silencioso":"Silent","Sin avisos anticipados. Android usa el volumen de notificaciones del teléfono.":"No advance alerts. Android uses the phone's notification volume.","Cancelar":"Cancel","Guardar":"Save","Eliminar":"Delete","Respaldo y restauración":"Backup and Restore","Guarda una copia completa fuera de la app, por ejemplo en Descargas. El archivo permanece aunque desinstales Registro Hábitos.":"Save a full backup outside the app, for example in Downloads. The file remains if you uninstall the app.","Guardar respaldo en el teléfono":"Save Backup to Phone","Restaurar desde un respaldo":"Restore from Backup","Incluye hábitos, categorías, imágenes, recordatorios y preferencias. Al restaurar, los registros existentes se conservan.":"Includes habits, categories, images, reminders and preferences. Existing entries are kept when restoring.","Exportar para análisis":"Export for Analysis","Exporta solamente tus registros de hábitos, sin configuraciones ni recordatorios. Puedes usarlos en otras herramientas.":"Export only your habit entries, without app settings or reminders. You can use them in other tools.","Filtrar por fecha":"Filter by Date","Puedes dejar una fecha vacía. Ambos días están incluidos.":"Either date can be left blank. Both dates are included.","Desde":"From","Hasta":"To","Deja las fechas vacías para incluir todos los registros. Ambos días están incluidos.":"Leave the dates blank to include all entries. Both dates are included.","Exportar hábitos JSON":"Export Habits JSON","Exportar hábitos CSV":"Export Habits CSV","Resumen":"Summary","Acerca de":"About","Preferencias sensoriales":"Sensory Preferences","Modo oscuro":"Dark Mode","Sin animaciones":"No Animations","Sin avisos anticipados.":"No advance alerts.","Versión":"Version","Compilación":"Build","Autor":"Author","Editar registro":"Edit Entry","¿Qué hiciste o cómo te sientes?":"What did you do or how did you feel?","Toca para dictar":"Tap to Dictate","Fecha":"Date","Hora":"Time","Categoría":"Category","Estado de ánimo":"Mood","Duración":"Duration","Horas":"Hours","Minutos":"Minutes","Energía":"Energy","Notas":"Notes","Cerrar":"Close","Eliminar registro":"Delete Entry","Palabras clave":"Keywords","Se utilizan para buscar y sugerir automáticamente esta categoría.":"Used to search and automatically suggest this category.","Color":"Color","Verde suave":"Soft Green","Azul":"Blue","Violeta":"Purple","Naranja":"Orange","Gris":"Gray","Imagen propia o foto":"Custom Image or Photo","Quitar imagen":"Remove Image","La imagen se ajusta y guarda en este dispositivo. No se sube a internet.":"The image is resized and stored on this device. It is not uploaded.","Elegir un ícono":"Choose an Icon","Confirmación":"Confirmation","Aceptar":"OK","Nueva entrada":"New Entry","Detalles opcionales":"Optional Details","Fecha y hora":"Date and Time","Registro":"Entries","Historial":"History","Recordatorios":"Reminders","Más":"More","Idioma":"Language","Idioma de la aplicación":"App Language","Sistema operativo":"System Default","Español":"Spanish","English":"English","De forma predeterminada, se utiliza el idioma del dispositivo.":"Uses your device language by default.","Actividad física":"Physical Activity","Alimentación":"Food","Terapia":"Therapy","Salud":"Health","Sueño":"Sleep","Emociones":"Emotions","Cognitivo":"Cognitive","Ocio":"Leisure","Trabajo":"Work","Personal":"Personal","Hidratación":"Hydration","Descanso":"Rest","Salida":"Going Out","Social":"Social","Higiene":"Hygiene","Ir al baño":"Bathroom","Tabaco":"Tobacco","Vapeo":"Vaping","Alcohol":"Alcohol","Medicación":"Medication","Cafeína":"Caffeine","Buscar categoría":"Search Categories","Sin categoría":"Uncategorized","Sin palabras clave":"No keywords","No hay categorías que coincidan.":"No matching categories.","No hay categorías. Agrega una con +.":"No categories yet. Add one with +.","Aún no has registrado nada hoy.":"No entries today yet.","Todavía no hay registros para mostrar.":"No entries to show.","Automática":"Automatic","Manual":"Manual","Nueva categoría":"New Category","Editar categoría":"Edit Category","Crear categoría":"Create Category","Guardar cambios":"Save","Confirmar":"Confirm","Información":"Information","Nueva entrada de ":"New entry for ","Categoría: ":"Category: ","Últimos 7 días":"Last 7 days","Últimos 30 días":"Last 30 days","Últimos 12 meses":"Last 12 months","Selecciona un respaldo ZIP.":"Select a ZIP backup.","No hay registros en ese período.":"No entries in that date range.","Entrada guardada":"Entry saved","Recordatorio guardado.":"Reminder saved.","Recordatorio actualizado.":"Reminder updated.","Escuchar audio":"Play Sound","Detener dictado":"Stop Dictation","Iniciar dictado":"Start Dictation","Escuchando… Toca otra vez para detener.":"Listening… Tap again to stop.","Escuchando… puedes hacer pausas. Toca para detener.":"Listening… You can pause. Tap to stop.","Dictado detenido.":"Dictation stopped.","Salir de la app":"Exit App","¿Quieres salir de Registro Hábitos?":"Do you want to exit Registro Hábitos?","Salir":"Exit","Guardar respaldo":"Save Backup","Restaurar":"Restore","Muy mal":"Very Bad","Mal":"Bad","Neutral":"Neutral","Bien":"Good","Muy bien":"Very Good"};
const RH_ALTERNATES={"Elegí":"Elige","Editá":"Edita","Agregá":"Agrega","Guardá":"Guarda","Exportá":"Exporta","Dejá":"Deja","Podés":"Puedes","Tocá":"Toca","Usá":"Usa","Ingresá":"Ingresa","Comprobá":"Comprueba","Activá":"Activa","Escribí":"Escribe"};
const RH_LANGUAGE_KEY="registro-habitos-language";
function languagePreference(){try{return localStorage.getItem(RH_LANGUAGE_KEY)||"system"}catch{return "system"}}
function systemAppLanguage(){const locale=navigator.languages?.[0]||navigator.language||"es";return /^es(?:-|$)/i.test(locale)?"es":"en"}
function currentAppLanguage(){const preference=languagePreference();return preference==="system"?systemAppLanguage():preference==="en"?"en":"es"}
function setLanguagePreference(value){
 const preference=["system","es","en"].includes(value)?value:"system";
 try{localStorage.setItem(RH_LANGUAGE_KEY,preference)}catch(error){console.warn(error)}
 const selector=document.getElementById("app-language");
 if(selector)selector.value=preference;
 applyAppLanguage();
}
const RH_REVERSE=Object.fromEntries(Object.entries(RH_TRANSLATIONS).map(([es,en])=>[en,es]));
function translateLabel(value,to){
 const trimmed=value.trim();
 if(!trimmed)return value;
 const normalized=Object.entries(RH_ALTERNATES).reduce((text,[before,after])=>text.replaceAll(before,after),trimmed);
 const translated=to==="en"?(RH_TRANSLATIONS[normalized]||RH_TRANSLATIONS[trimmed]):(RH_REVERSE[trimmed]||normalized);
 if(!translated || translated===trimmed)return value;
 const initial=value.slice(0,value.indexOf(trimmed));
 const trailing=value.slice(value.indexOf(trimmed)+trimmed.length);
 return initial+translated+trailing;
}
let RH_UPDATING=false;
const RH_SKIP='script,style,textarea,input,svg,code,pre,[contenteditable],.user-content,.item-main strong';
function translateNode(node,to){
 if(node.nodeType===3){
  if(node.parentElement?.closest(RH_SKIP))return;
  const next=translateLabel(node.nodeValue,to);
  if(next!==node.nodeValue)node.nodeValue=next;
  return;
 }
 if(node.nodeType!==1||node.matches(RH_SKIP))return;
 for(const attr of ["placeholder","title","aria-label"]){
  const value=node.getAttribute(attr);
  if(value){
   const next=translateLabel(value,to);
   if(next!==value)node.setAttribute(attr,next);
  }
 }
 for(const child of node.childNodes)translateNode(child,to);
}
function applyAppLanguage(){
 const language=currentAppLanguage();
 document.documentElement.lang=language;
 document.querySelector("#app-language").value=languagePreference();
 RH_UPDATING=true;
 try{translateNode(document.body,language)}
 finally{RH_UPDATING=false}
}
const RH_OBSERVER=new MutationObserver(records=>{
 if(RH_UPDATING)return;
 RH_UPDATING=true;
 try{
  const lang=currentAppLanguage();
  for(const record of records){
   if(record.type==="characterData")translateNode(record.target,lang);
   else for(const node of record.addedNodes)translateNode(node,lang);
  }
 }finally{RH_UPDATING=false}
});
document.querySelector("#app-language").addEventListener("change",event=>setLanguagePreference(event.target.value));
applyAppLanguage();
RH_OBSERVER.observe(document.body,{subtree:true,childList:true,characterData:true});
window.addEventListener("pageshow",()=>{if(languagePreference()==="system")applyAppLanguage()});
