import { storage } from "./storage.js";
import { suggestCategory } from "./classifier.js";
const $=id=>document.getElementById(id);
const preset=[["Actividad física","🚶","green"],["Alimentación","🍴","orange"],["Terapia","♥","purple"],["Salud","💧","blue"],["Sueño","☾","purple"],["Emociones","☁","grey"],["Cognitivo","◉","orange"],["Ocio","▣","blue"],["Trabajo","▣","orange"],["Personal","●","grey"],["Hidratación","💧","blue"],["Descanso","☾","purple"],["Salida","🚶","green"],["Social","♥","purple"],["Higiene","✦","blue"],["Ir al baño","🚻","blue"],["Tabaco","♨","orange"],["Vapeo","≈","purple"],["Alcohol","◌","orange"],["Medicación","✚","blue"],["Cafeína","☕","orange"]];
const canonicalCategory=name=>{const raw=String(name||"").trim();return preset.find(p=>p[0].toLowerCase()===raw.toLowerCase())?.[0]||raw};
const byCategory=name=>preset.find(p=>p[0]===canonicalCategory(name))||[name||"Personal","✦","grey"];
const unique=a=>[...new Set(a.filter(Boolean))];
const localTime=d=>{const date=new Date(d);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatTime=v=>new Date(v).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
const dayKey=v=>localTime(v).slice(0,10);
let entries=[],current=null,mood=null,period="week",previous="capture",recognition=null,categoryFilter="",editingReminderId=null,quickSaving=false,lastQuickEntryId=null;
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
function toast(message){const id=$("capture-status");if(id)id.textContent=message;}
function show(page){
    if(page==="edit")previous="history";
    ["capture","history","categories","edit","summary","reminders","data","more"].forEach(s=>$(s).classList.toggle("active",s===page));
    const labels={capture:"Mi día",history:"Historial",categories:"Categorías",edit:"Editar registro",summary:"Resumen",reminders:"Recordatorios",data:"Importar / Exportar",more:"Más"};
    $("title").textContent=labels[page];$("back").classList.toggle("hidden",["capture","history","reminders","more"].includes(page));
    $("top-action").textContent=page==="capture"?"⚙":page==="history"?"⋮":page==="reminders"?"＋":"";
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===page || (page==="edit"&&b.dataset.page==="history") || (["categories","summary","data"].includes(page)&&b.dataset.page==="more")));
    $("add-entry").classList.toggle("hidden",page!=="capture");
    if(page==="capture")drawDashboard();if(page==="history")drawHistory();if(page==="categories")drawCategories();if(page==="summary")drawSummary();if(page==="reminders")drawReminders();
    window.scrollTo(0,0);
}
function iconFor(category){
 const p=byCategory(category), icons={"Actividad física":"walk","Alimentación":"food","Terapia":"heart","Salud":"water","Sueño":"moon","Emociones":"cloud","Cognitivo":"person","Ocio":"book","Trabajo":"briefcase","Personal":"person","Hidratación":"water","Descanso":"moon","Salida":"walk","Social":"heart","Ir al baño":"toilet","Tabaco":"smoke","Vapeo":"vape","Alcohol":"glass","Medicación":"pill","Cafeína":"coffee","Higiene":"shower"};
 const box=el("span","entry-icon "+(p[2]||""));const name=icons[p[0]]||"leaf";
 box.innerHTML='<svg class="icon"><use href="#i-'+name+'"></use></svg>';return box;
}
function categoryOptions(){
 const cats=unique([...preset.map(p=>p[0]),...entries.map(e=>canonicalCategory(e.category)),...customCategories().map(canonicalCategory)]);
 const select=$("edit-category");select.replaceChildren(new Option("Sin categoría",""),...cats.map(c=>new Option(c,c)));return cats;
}
function customCategories(){try{return JSON.parse(localStorage.getItem("rh-categories")||"[]")}catch{return []}}
function saveCategory(name){localStorage.setItem("rh-categories",JSON.stringify(unique([...customCategories(),name])))}
function quickDescription(category){
 const phrases={
  "Ir al baño":"Fui al baño","Tabaco":"Fumé tabaco","Vapeo":"Vapeé",
  "Alcohol":"Tomé alcohol","Hidratación":"Tomé agua","Cafeína":"Tomé café",
  "Medicación":"Tomé medicación","Sueño":"Dormí","Higiene":"Higiene personal",
  "Descanso":"Descansé","Actividad física":"Hice actividad física"
 };
 return phrases[category]||category;
}
function categoryNames(){
 return unique([...preset.map(x=>x[0]),...customCategories().map(canonicalCategory),...entries.map(e=>canonicalCategory(e.category))]);
}
function normalizeCategorySearch(text){
 return String(text||"").toLocaleLowerCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}
const categoryAliases={
 "Ir al baño":["pis","orinar","orine","evacuar","defecar","inodoro","wc","caca"],
 "Tabaco":["fumar","fume","fumando","cigarrillo","pucho","cigarro"],
 "Vapeo":["vapear","vape","vaper","cigarrillo electronico"],
 "Alcohol":["cerveza","vino","fernet","birra","trago"],
 "Cafeína":["cafe","mate","energizante"],
 "Hidratación":["agua","beber agua"],
 "Alimentación":["comer","desayuno","almuerzo","merienda","cena"],
 "Actividad física":["caminar","caminata","correr","ejercicio","entrenar"],
 "Sueño":["dormir","siesta","despertar"],
 "Medicación":["medicamento","pastilla","remedio"],
 "Higiene":["ducha","duchar","lavar"],
 "Social":["charlar","llamada","amigos"]
};
function matchesCategorySearch(category,query){
 const terms=normalizeCategorySearch(query).split(/\s+/).filter(Boolean);
 if(!terms.length)return true;
 const haystack=normalizeCategorySearch([
  category,quickDescription(category),...(categoryAliases[category]||[])
 ].join(" "));
 return terms.every(term=>haystack.includes(term));
}
function drawDashboard(){
 const grid=$("quick-categories");grid.replaceChildren();
 const names=categoryNames().filter(name=>matchesCategorySearch(name,$("category-search").value));
 if(!names.length)grid.append(el("p","category-no-results","No hay categorías que coincidan."));
 for(const category of names){
  const button=el("button","quick-category");
  button.type="button";button.setAttribute("aria-label","Registrar "+category);
  const badge=iconFor(category);badge.setAttribute("aria-hidden","true");
  button.append(badge,el("span","quick-name",category));
  button.onclick=()=>saveQuickCategory(category);
  grid.append(button);
 }
 const today=entries.filter(e=>dayKey(e.occurredAt)===dayKey(Date.now()));
 $("today-count").textContent=today.length+" "+(today.length===1?"registro":"registros");
 const recent=$("today-entries");recent.replaceChildren();
 if(!today.length){recent.append(el("p","muted","Todavía no registraste nada hoy."));return;}
 for(const entry of today.slice(0,5)){
  const button=el("button","history-item");
  button.append(iconFor(entry.category));
  const body=el("span","item-main");
  body.append(el("strong","",entry.description),el("small","",formatTime(entry.occurredAt)));
  button.append(body);button.onclick=()=>openEdit(entry);recent.append(button);
 }
}
function showCaptureFeedback(message,entry=null){
 $("quick-feedback").classList.toggle("has-message",Boolean(message));
 $("capture-status").textContent=message;
 lastQuickEntryId=entry?.id||null;
 $("undo-quick").classList.toggle("hidden",!entry);
}
function createEntry(details){
 return {
  description:details.description,occurredAt:details.occurredAt,
  category:details.category||null,categorySource:details.categorySource||null,
  energy:details.energy??null,mood:details.mood??null,
  duration:details.duration??null,notes:details.notes||""
 };
}
async function saveQuickCategory(category){
 if(quickSaving)return;
 quickSaving=true;
 try{
  const record=await storage.save(createEntry({
   description:quickDescription(category),occurredAt:new Date().toISOString(),
   category,categorySource:"manual"
  }));
  await reload();
  showCaptureFeedback("Guardado: "+category+" · "+formatTime(record.occurredAt),record);
 }catch(error){showCaptureFeedback("No se pudo guardar: "+error.message);}
 finally{quickSaving=false;}
}
function resetEntryOptions(){
 $("capture-text").value="";
 $("entry-status").textContent="";
 $("entry-when").value=localTime(new Date());
 const cats=categoryNames();
 $("entry-category").replaceChildren(new Option("Automática",""),...cats.map(c=>new Option(c,c)));
 $("entry-category").value="";
 for(const name of ["energy","mood"]){
  $("entry-"+name).value=5;
  $("entry-"+name+"-enabled").checked=false;
  $("entry-"+name+"-value").textContent="—";
 }
 $("entry-duration").value="";$("entry-notes").value="";
 $("entry-options").open=false;
}
function openEntryDialog(){
 resetEntryOptions();
 $("entry-dialog").showModal();
}
function closeEntryDialog(){
 if(recognition){try{recognition.stop()}catch(_){}}
 $("entry-dialog").close();
}
async function reload(){entries=await storage.list();drawHistory();drawCategories();drawSummary();drawDashboard();}
function openEdit(e){
 current=e;mood=e.mood??null;
 $("edit-text").value=e.description;$("edit-date").value=dayKey(e.occurredAt);$("edit-time").value=localTime(e.occurredAt).slice(11);
 categoryOptions();$("edit-category").value=canonicalCategory(e.category);
 $("edit-duration").value=e.duration??"";$("edit-notes").value=e.notes||"";
 $("energy-enabled").checked=e.energy!=null;$("edit-energy").value=e.energy??5;$("energy-number").textContent=e.energy??"—";
 document.querySelectorAll("#moods button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.mood)===mood));
 show("edit");
}
function drawHistory(){
 const q=$("search").value.trim().toLocaleLowerCase("es-AR");
 const root=$("history-list");root.replaceChildren();
 const matches=entries.filter(e=>(!categoryFilter||canonicalCategory(e.category)===categoryFilter)&&(!q||[e.description,e.notes,e.category].join(" ").toLocaleLowerCase("es-AR").includes(q)));
 if(!matches.length){root.append(el("p","muted","Todavía no hay registros para mostrar."));return;}
 for(const e of matches){
  const row=el("button","history-item");row.append(iconFor(e.category));
  const body=el("span","item-main");body.append(el("strong","",e.description));
  const small=el("small","",(dayKey(e.occurredAt)===dayKey(Date.now())?"Hoy ":"")+formatTime(e.occurredAt));
  if(e.category){small.append(el("span","pill",canonicalCategory(e.category)));}
  body.append(small);row.append(body);if(e.mood!=null)row.append(el("span","face",e.mood>=7?"●":e.mood<=3?"☹":"●"));
  row.append(el("span","muted","⋮"));row.onclick=()=>openEdit(e);root.append(row);
 }
}
function drawCategories(){
 const root=$("category-list");root.replaceChildren();
 const names=unique([...preset.map(x=>x[0]),...customCategories().map(canonicalCategory),...entries.map(e=>canonicalCategory(e.category))]);
 for(const cat of names){const count=entries.filter(e=>canonicalCategory(e.category)===cat).length;const row=el("button","category-item");row.append(iconFor(cat),el("span","item-main",cat),el("span","muted",String(count)));row.onclick=()=>{categoryFilter=cat;$("search").value="";show("history")};root.append(row);}
}
function drawSummary(){
 const now=new Date(),start=new Date(now),buckets=period==="week"?7:period==="month"?30:12;
 const label=period==="week"?"Últimos 7 días":period==="month"?"Últimos 30 días":"Últimos 12 meses";
 $("period-label").textContent=label;const counts=Array(buckets).fill(0);
 for(const e of entries){const d=new Date(e.occurredAt);const days=Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000);
  const idx=period==="year"?((now.getFullYear()-d.getFullYear())*12+now.getMonth()-d.getMonth()):days;
  if(idx>=0&&idx<buckets)counts[buckets-1-idx]++;
 }
 const max=Math.max(1,...counts);const chart=$("chart");chart.replaceChildren();
 for(let i=0;i<buckets;i++){const cell=el("div","bar-cell");const bar=el("div","bar");bar.style.height=(counts[i]/max*130)+"px";bar.title=counts[i]+" registros";cell.append(bar,el("span","",period==="week"?["L","M","X","J","V","S","D"][(now.getDay()+1+i)%7]:period==="month"?(i%5===0?String(i+1):""):String((i+now.getMonth()+1)%12+1)));chart.append(cell);}
 const countsCat=new Map();entries.forEach(e=>{const cat=canonicalCategory(e.category)||"Sin categoría";countsCat.set(cat,(countsCat.get(cat)||0)+1)});
 const root=$("summary-categories");root.replaceChildren();for(const [cat,count] of [...countsCat].sort((a,b)=>b[1]-a[1])){const row=el("div","category-item");row.append(iconFor(cat),el("span","item-main",cat),el("span","muted",String(count)));root.append(row);}
 $("summary-count").textContent=entries.length+" registros en total";
}
async function saveCapture(){
 const description=$("capture-text").value.trim();
 if(!description){$("capture-text").focus();return;}
 if(quickSaving)return;
 const date=$("entry-when").value,occurredAt=new Date(date||Date.now());
 if(!Number.isFinite(occurredAt.getTime())){
  $("entry-status").textContent="Ingresá una fecha válida.";return;
 }
 const manual=canonicalCategory($("entry-category").value);
 const suggested=manual?null:suggestCategory(description,entries);
 const category=manual||canonicalCategory(suggested?.category)||null;
 const durationText=$("entry-duration").value.trim(),duration=durationText===""?null:Number(durationText);
 if(duration!=null&&(!Number.isFinite(duration)||duration<0)){
  $("entry-status").textContent="La duración debe ser positiva.";return;
 }
 quickSaving=true;
 $("capture-save").disabled=true;
 try{
  const record=await storage.save(createEntry({
   description,occurredAt:occurredAt.toISOString(),category,
   categorySource:manual?"manual":suggested?.source||null,
   energy:$("entry-energy-enabled").checked?Number($("entry-energy").value):null,
   mood:$("entry-mood-enabled").checked?Number($("entry-mood").value):null,
   duration,notes:$("entry-notes").value.trim()
  }));
  closeEntryDialog();await reload();
  showCaptureFeedback("Entrada guardada · "+formatTime(record.occurredAt),record);
 }catch(error){$("entry-status").textContent="No se pudo guardar: "+error.message;}
 finally{quickSaving=false;$("capture-save").disabled=false;}
}
function csv(){const cols=["id","occurredAt","createdAt","updatedAt","description","category","categorySource","energy","mood","duration","notes"];const esc=x=>'"'+String(x??"").replaceAll('"','""')+'"';return "\uFEFF"+[cols.join(","),...entries.map(e=>cols.map(k=>esc(e[k])).join(","))].join("\r\n")}
function download(name,text,type){const share=window.NativeBridge?.Android?.intents?.share;if(share){const ok=share({text,subject:name,title:name,chooserTitle:"Compartir datos",type:"text/plain"});if(ok)return;}const url=URL.createObjectURL(new Blob([text],{type}));const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function openReminderDialog(item=null){
 editingReminderId=item?.id||null;
 $("reminder-dialog-title").textContent=item?"Editar recordatorio":"Nuevo recordatorio";
 $("reminder-name").value=item?.title||"";
 $("reminder-time").value=item?.time||"13:00";
 $("reminder-repeat").value=item?.repeat||(item?.daily?"daily":"once");
 $("reminder-sound").value=item?.sound||"none";
 $("reminder-confirm").textContent=item?"Guardar cambios":"Guardar";
 $("reminder-delete").classList.toggle("hidden",!item);
 $("reminder-dialog").showModal();
}
function drawReminders(){
 const root=$("reminder-list");root.replaceChildren();const items=reminderStore.list();
 for(const item of items){const row=el("div","reminder-item");row.append(iconFor(item.title.toLowerCase().includes("agua")?"Salud":item.title.toLowerCase().includes("dorm")?"Sueño":"Personal"));
  const body=el("span","item-main");body.append(el("strong","",item.title),el("small","",item.time+" · "+(item.repeat==="weekdays"?"Lun a vie":item.daily?"Todos los días":"Una vez")));row.append(body);
  const toggle=el("button",item.enabled===false?"":"on",item.enabled===false?"○":"●");toggle.setAttribute("aria-label",item.enabled===false?"Activar":"Desactivar");toggle.onclick=async()=>{try{await reminderStore.setEnabled(item.id,item.enabled===false);drawReminders()}catch(e){$("reminder-status").textContent=e.message}};
  const edit=el("button","reminder-edit","✎");edit.setAttribute("aria-label","Editar "+item.title);edit.title="Editar recordatorio";edit.onclick=()=>openReminderDialog(item);row.append(toggle,edit);root.append(row);
 }
 if(!items.length)root.append(el("p","muted","Todavía no hay recordatorios."));
}
async function importBackup(file){
 const backup=JSON.parse(await file.text());if(backup.version!==1||!Array.isArray(backup.entries))throw Error("Formato JSON incompatible");
 const ids=new Set();for(const e of backup.entries){if(!e||typeof e.id!=="string"||ids.has(e.id)||typeof e.description!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||!Number.isFinite(Date.parse(e.createdAt)))throw Error("Entrada inválida en el archivo");ids.add(e.id);}
 if(!confirm("Importar "+backup.entries.length+" entradas? No se sobrescribirán las actuales."))return;
 const n=await storage.importEntries(backup.entries);
 if(Array.isArray(backup.categories))for(const cat of backup.categories){if(typeof cat==="string"&&cat.trim())saveCategory(cat.trim());}
 await reload();
 let notice="Importadas "+n.imported+" entradas. "+n.skipped+" ya existían.";
 if(Array.isArray(backup.reminders)&&backup.reminders.length){
  const existing=new Set(reminderStore.list().map(r=>r.title+"|"+r.time+"|"+r.repeat));
  const add=backup.reminders.filter(r=>r&&typeof r.title==="string"&&/^[0-2][0-9]:[0-5][0-9]$/.test(r.time)&&!existing.has(r.title+"|"+r.time+"|"+r.repeat));
  if(add.length&&confirm("El respaldo incluye "+add.length+" recordatorios nuevos. ¿Querés programarlos en este dispositivo?")){
   let done=0;
   for(const r of add){
    try{const item=await reminderStore.add(r.title,r.time,r.repeat!=="once",r.repeat||"daily",r.sound||"none");if(r.enabled===false)await reminderStore.setEnabled(item.id,false);done++;}
    catch(err){notice+=" Algunos recordatorios no pudieron programarse: "+err.message;break;}
   }
   notice+=" Recordatorios restaurados: "+done+".";
  }
 }
 alert(notice);
}
// Use the SpeechRecognition implementation supplied by the browser/WebView.
// Browser speech engines may use a remote service when on-device recognition is
// unavailable; the app itself does not upload or store the microphone audio.
let voicePending = false;
function voiceFeedback(targetId, message) {
 const status = $(targetId === "edit-text" ? "edit-voice-status" : "entry-status");
 if (status) status.textContent = message;
}
function voiceButtons(active) {
 for (const id of ["mic", "edit-dictate"]) {
  const button = $(id);
  button.classList.toggle("listening", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.setAttribute("aria-label", active ? "Detener dictado" : "Dictar");
 }
}
async function startVoice(targetId = "capture-text") {
 const field = $(targetId);
 if (recognition) {
  try { recognition.stop(); } catch (_) { /* Already stopping. */ }
  return;
 }
 if (voicePending) return;
 const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
 if (typeof Rec !== "function") {
  voiceFeedback(targetId, "Este navegador no ofrece reconocimiento de voz.");
  field.focus();
  return;
 }
 voicePending = true;
 try {
  // KCAPK has RECORD_AUDIO in its Manifest; ask for the runtime permission
  // through the tested Android bridge before invoking browser recognition.
  const permissions = window.NativeBridge?.Android?.permissions;
  if (permissions && !permissions.has("microphone")) {
   voiceFeedback(targetId, "Solicitando permiso de micrófono…");
   if (!await permissions.request("microphone")) {
    voiceFeedback(targetId, "El permiso de micrófono no está habilitado.");
    return;
   }
  }
  const r = new Rec();
  r.lang = "es-AR";
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  // Use the browser's configured recognizer, including its online/offline
  // preference. Requiring processLocally would disable voice on Android.
  const original = field.value.trim();
  r.onstart = () => { voiceButtons(true); voiceFeedback(targetId, "Escuchando… Tocá otra vez para terminar."); };
  r.onresult = event => {
   let transcript = "";
   for (let i = 0; i < event.results.length; i++) {
    if (event.results[i][0]) transcript += event.results[i][0].transcript + " ";
   }
   field.value = [original, transcript.trim()].filter(Boolean).join(" ");
   field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  r.onerror = event => {
   const messages = {
    "not-allowed": "El navegador rechazó el dictado. Si ya permitiste el micrófono en Android, comprobá el servicio de voz del dispositivo.",
    "service-not-allowed": "El servicio de voz está bloqueado en este navegador.",
    "audio-capture": "No se pudo acceder al micrófono.",
    "no-speech": "No se detectó voz. Podés intentarlo de nuevo.",
    "network": "El motor de voz del navegador necesita conexión.",
    "language-not-supported": "El motor de voz no admite español (Argentina)."
   };
   voiceFeedback(targetId, messages[event.error] || "Error de dictado: " + event.error);
   voiceButtons(false);
  };
  r.onend = () => {
   if (recognition === r) recognition = null;
   voiceButtons(false);
   const status = $(targetId === "edit-text" ? "edit-voice-status" : "entry-status");
   if (status?.textContent.startsWith("Escuchando")) status.textContent = field.value.trim() ? "Dictado terminado." : "No se registró texto.";
  };
  recognition = r;
  try {
   r.start();
  } catch (error) {
   recognition = null;
   voiceButtons(false);
   voiceFeedback(targetId, "No se pudo iniciar el dictado: " + (error.message || error));
   field.focus();
  }
 } catch (error) {
  voiceFeedback(targetId, "No se pudo iniciar el micrófono: " + (error.message || error));
  field.focus();
 } finally {
  voicePending = false;
 }
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>show(b.dataset.page));
$("back").onclick=()=>show(["categories","summary","data"].includes(document.querySelector(".screen.active").id)?"more":"history");
$("top-action").onclick=()=>{const page=document.querySelector(".screen.active").id;if(page==="reminders")openReminderDialog();else show(page==="capture"?"more":"data")};
$("category-search").addEventListener("input",drawDashboard);
$("add-entry").onclick=openEntryDialog;
$("entry-close").onclick=closeEntryDialog;
$("entry-cancel").onclick=closeEntryDialog;
$("entry-dialog").addEventListener("close",()=>{if(recognition){try{recognition.stop()}catch(_){}}});
$("capture-save").onclick=saveCapture;
$("mic").onclick=()=>startVoice("capture-text");
$("edit-dictate").onclick=()=>startVoice("edit-text");
$("undo-quick").onclick=async()=>{
 if(!lastQuickEntryId)return;
 const id=lastQuickEntryId;lastQuickEntryId=null;
 $("undo-quick").classList.add("hidden");
 try{await storage.remove(id);await reload();showCaptureFeedback("Entrada deshecha.");}
 catch(error){showCaptureFeedback("No se pudo deshacer: "+error.message);}
};
for(const name of ["energy","mood"]){
 $("entry-"+name).oninput=()=>{
  $("entry-"+name+"-enabled").checked=true;
  $("entry-"+name+"-value").textContent=$("entry-"+name).value+"/10";
 };
 $("entry-"+name+"-enabled").onchange=()=>{
  $("entry-"+name+"-value").textContent=$("entry-"+name+"-enabled").checked?$("entry-"+name).value+"/10":"—";
 };
}
$("history-filter").onclick=()=>{categoryFilter="";show("categories")};
$("category-add").onclick=()=>{const cat=prompt("Nombre de la categoría");if(cat?.trim()){saveCategory(cat.trim());drawCategories()}};
$("search").oninput=drawHistory;
$("edit-energy").oninput=()=>{$("energy-enabled").checked=true;$("energy-number").textContent=$("edit-energy").value};
$("energy-enabled").onchange=()=>{$("energy-number").textContent=$("energy-enabled").checked?$("edit-energy").value:"—"};
document.querySelectorAll("#moods button").forEach(b=>b.onclick=()=>{mood=Number(b.dataset.mood);document.querySelectorAll("#moods button").forEach(a=>a.classList.toggle("selected",a===b))});
$("edit-save").onclick=async()=>{
 if(!current)return;const description=$("edit-text").value.trim();if(!description){$("edit-text").focus();return;}
 const date=$("edit-date").value,time=$("edit-time").value;if(!date||!time)return;
 try{await storage.save({...current,description,occurredAt:new Date(date+"T"+time+":00").toISOString(),category:canonicalCategory($("edit-category").value)||null,categorySource:"manual",mood,energy:$("energy-enabled").checked?Number($("edit-energy").value):null,duration:$("edit-duration").value===""?null:Number($("edit-duration").value),notes:$("edit-notes").value});await reload();show("history")}catch(e){alert(e.message)}
};
$("edit-delete").onclick=async()=>{if(!current||!confirm("¿Eliminar este registro?"))return;await storage.remove(current.id);await reload();show("history")};
document.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll("[data-period]").forEach(a=>a.classList.toggle("selected",a===b));drawSummary()});

let previewAudio=null;
$("preview-sound").onclick=()=>{
 const name=$("reminder-sound").value;
 if(previewAudio){previewAudio.pause();previewAudio=null;}
 if(name==="none")return;
 previewAudio=new Audio(name==="glock"?"./sounds/glock.mp3":"./sounds/alert.mp3");
 previewAudio.volume=Number($("preview-volume").value)/100;
 previewAudio.play().catch(err=>$("reminder-status").textContent="No se pudo reproducir el audio: "+err.message);
};
$("reminder-dialog").addEventListener("close",()=>{if(previewAudio){previewAudio.pause();previewAudio=null}});
$("reminder-confirm").onclick=async e=>{
 e.preventDefault();
 const title=$("reminder-name").value.trim(),time=$("reminder-time").value,repeat=$("reminder-repeat").value,sound=$("reminder-sound").value;
 if(!title||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)){
  $("reminder-status").textContent="Escribí un nombre y una hora válida.";return;
 }
 try{
  if(editingReminderId)await reminderStore.update(editingReminderId,{title,time,repeat,daily:repeat!=="once",sound});
  else await reminderStore.add(title,time,repeat!=="once",repeat,sound);
  $("reminder-dialog").close();
  $("reminder-status").textContent=editingReminderId?"Recordatorio actualizado.":"Recordatorio guardado.";
  editingReminderId=null;drawReminders();
 }catch(err){$("reminder-status").textContent=err.message}
};
$("reminder-delete").onclick=()=>{
 if(!editingReminderId||!confirm("¿Eliminar este recordatorio?"))return;
 reminderStore.remove(editingReminderId);
 editingReminderId=null;$("reminder-dialog").close();drawReminders();
 $("reminder-status").textContent="Recordatorio eliminado.";
};
$("export-json").onclick=()=>download("registro-habitos.json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries,reminders:reminderStore.list(),categories:customCategories()},null,2),"application/json");
$("export-csv").onclick=()=>download("registro-habitos.csv",csv(),"text/csv;charset=utf-8");
$("import-json").onclick=()=>{if(window.NativeBridge?.Android?.clipboard){const copied=window.NativeBridge.Android.clipboard.get();if(copied?.trim().startsWith("{")){$("import-text").value=copied;$("import-dialog").showModal();return;}}$("import-file").click();};
$("import-text-btn").onclick=()=>{$("import-dialog").showModal();};
$("import-cancel").onclick=()=>$("import-dialog").close();
$("import-confirm").onclick=async()=>{
 try{const content=$("import-text").value;await importBackup({text:async()=>content});$("import-dialog").close();$("import-text").value="";}
 catch(e){alert("No se pudo importar: "+e.message);}
};
$("import-file").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{await importBackup(file)}catch(err){alert("No se pudo importar: "+err.message)}finally{e.target.value=""}};
$("reduced-motion").onchange=e=>{document.documentElement.classList.toggle("reduce-motion",e.target.checked)};
// A one-time, same-APK migration preserves records from the old file:// origin
// when switching to the synthetic HTTPS origin required for Web Speech.
if (window.top !== window && location.search === "?migration=1") {
 window.addEventListener("message", async event => {
  if (event.source !== window.parent || event.origin !== "null" || event.data?.type !== "rh-migrate") return;
  try {
   const backup = event.data.backup;
   if (!backup || !Array.isArray(backup.entries)) throw new Error("Respaldo inválido");
   await storage.importEntries(backup.entries);
   if (Array.isArray(backup.categories))
    localStorage.setItem("rh-categories", JSON.stringify(backup.categories));
   if (Array.isArray(backup.reminders))
    localStorage.setItem("registro-habitos-reminders", JSON.stringify(backup.reminders));
   window.parent.postMessage({type:"rh-complete"}, "*");
  } catch (error) {
   window.parent.postMessage({type:"rh-error", message:String(error.message||error)}, "*");
  }
 });
 window.parent.postMessage({type:"rh-ready"}, "*");
} else {
 $("build-version").textContent="Versión de interfaz: "+(document.querySelector('meta[name="app-build"]')?.content || "desarrollo");
 reload().catch(e=>toast("No se pudo abrir la base local: "+e.message));
 try{reminderStore.refresh()}catch(e){console.warn(e)}
}
