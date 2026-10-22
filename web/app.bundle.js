// Generated bundle from storage, classifier, reminders and app modules.
// Storage interface: replace this adapter with SQLite without changing capture.
const DB_NAME = "registro-habitos";
const TABLE = "entries";
let dbPromise;

function connect() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(TABLE)) {
                    const store = db.createObjectStore(TABLE, { keyPath: "id" });
                    store.createIndex("occurredAt", "occurredAt");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}
async function transact(mode, action) {
    const db = await connect();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TABLE, mode);
        const req = action(tx.objectStore(TABLE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
    });
}
const storage = {
    async list() {
        const entries = await transact("readonly", store => store.getAll());
        return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },
    async save(entry) {
        const now = new Date().toISOString();
        const record = { ...entry, id: entry.id || (globalThis.crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "entry-" + Date.now() + "-" + Math.random().toString(36).slice(2)), createdAt: entry.createdAt || now, updatedAt: now };
        await transact("readwrite", store => store.put(record));
        return record;
    },
    async importEntries(records) {
        const db = await connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(TABLE, "readwrite");
            const store = tx.objectStore(TABLE);
            let imported = 0, skipped = 0;
            for (const record of records) {
                const request = store.get(record.id);
                request.onsuccess = () => {
                    if (request.result) { skipped++; return; }
                    store.add(record);
                    imported++;
                };
            }
            tx.oncomplete = () => resolve({ imported, skipped });
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Import cancelled"));
        });
    },
    async remove(id) { await transact("readwrite", store => store.delete(id)); },
};

// Classification is best effort; it must never block or alter capture.
// A native liblng adapter can pass ISO language codes when available.
const rulesByLanguage = {
    es: [
        ["sueño", /dorm|acost|despert|siesta|levant/i],
        ["alimentación", /com[ií]|desayun|almorz|cen[ée]|merend/i],
        ["hidratación", /agua|hidrat|beb[ií]/i],
        ["salida", /sal[ií]|camin|pase|calle|viaj|compr/i],
        ["higiene", /duch|bañ|lav|dient/i],
        ["social", /habl|llam|charl|visit|mensaje|amig/i],
        ["descanso", /descans|pausa|relaj/i],
    ],
};
const words = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 2));

function suggestCategory(text, entries, language = null) {
    const tokens = words(text);
    if (!tokens.size) return null;
    let winner = null, best = 0;
    for (const entry of entries) {
        if (!entry.category || !entry.description) continue;
        // A known language must not borrow training examples from another one.
        if (language && entry.language && entry.language !== language) continue;
        const other = words(entry.description);
        const overlap = [...tokens].filter(t => other.has(t)).length;
        const score = overlap / Math.max(tokens.size, other.size, 1) + (entry.categorySource === "manual" ? 0.15 : 0);
        if (score > best) { best = score; winner = entry.category; }
    }
    if (best >= 0.35) return { category: winner, source: "precedent", confidence: Math.min(best, 1), language };
    // Spanish is the default UI language until native detection is connected.
    const rule = (rulesByLanguage[language || "es"] || []).find(([, test]) => test.test(text));
    return rule ? { category: rule[0], source: "rule", confidence: 0.3, language: language || "es" } : null;
}

// Local persistent reminder definitions; Android alarms are independent of WebView lifetime.
const REMINDER_KEY="registro-habitos-reminders";
const reminderStore={
 list(){try{return JSON.parse(localStorage.getItem(REMINDER_KEY)||"[]")}catch{return []}},
 persist(items){localStorage.setItem(REMINDER_KEY,JSON.stringify(items))},
 api(){return window.NativeBridge?.Android?.alarms},
 channel(sound){
  // Sound channels are stable Android settings; custom packaged MP3 needs native resource mapping.
  const key=sound==="none"?"silent":"soft";
  const id="registro-"+key;
  const notifications=window.NativeBridge?.Android?.notifications;
  if(notifications)notifications.createChannel({id,name:"Registro Hábitos",importance:"low",sound:"none",showBadge:false});
  return id;
 },
 async permission(){
  const a=window.NativeBridge?.Android;
  if(!a?.alarms)throw Error("Recordatorios nativos disponibles al instalar el APK de KCAPK.");
  if(a.notifications&&a.permissions&&!a.notifications.canPost()){
   if(!await a.permissions.request("notifications"))throw Error("El permiso de notificaciones está desactivado.");
  }
 },
 occurrences(item){
  const [hour,minute]=item.time.split(":").map(Number),result=[];
  // Every launch can extend the upcoming 28-day window.
  for(let offset=0;offset<28;offset++){
   const day=new Date();day.setHours(hour,minute,0,0);day.setDate(day.getDate()+offset);
   if(day.getTime()<=Date.now())continue;
   if(item.repeat==="weekdays"&&(day.getDay()===0||day.getDay()===6))continue;
   result.push(day.getTime());if(item.repeat==="once")break;
  }
  return result;
 },
 schedule(item){
  const api=this.api();if(!api)throw Error("Alarmas nativas no disponibles.");
  const channel=this.channel(item.sound||"none");
  // Idempotent scheduling: clear the whole reserved ID block first.
  for(let i=0;i<29;i++)api.cancel(item.base+i);
  const moments=this.occurrences(item);
  for(let i=0;i<moments.length;i++){
   const ok=api.schedule({id:item.base+i,at:moments[i],exact:false,
    action:{type:"notification",id:item.base+i,channel,title:item.title,text:"Recordatorio",onlyAlertOnce:true,sound:"none"}});
   if(!ok)throw Error("No se pudo programar el aviso en Android.");
  }
 },
 async add(title,time,daily,repeat,sound){
  await this.permission();const entries=this.list();
  const base=100000+Math.floor(Math.random()*45000000)*32;
  const item={id:String(base),base,title,time,daily:!!daily,repeat:repeat|| (daily?"daily":"once"),sound:sound||"none",enabled:true};
  this.schedule(item);entries.push(item);this.persist(entries);return item;
 },
 async update(id,changes){
  const items=this.list(),index=items.findIndex(item=>item.id===id);
  if(index<0)throw Error("El recordatorio ya no existe.");
  const current=items[index];
  const updated={...current,title:changes.title,time:changes.time,repeat:changes.repeat,daily:changes.daily,sound:changes.sound};
  if(!updated.title||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(updated.time))
   throw Error("El nombre o la hora del recordatorio no son válidos.");
  if(updated.enabled!==false){
   await this.permission();
   try{this.schedule(updated)}
   catch(error){try{this.schedule(current)}catch(rollback){console.warn("Unable to restore reminder alarms",rollback)}throw error}
  }else if(this.api()){
   for(let i=0;i<29;i++)this.api().cancel(updated.base+i);
  }
  items[index]=updated;
  this.persist(items);
  return updated;
 },
 async setEnabled(id,enabled){
  const list=this.list(),item=list.find(x=>x.id===id);if(!item)return;
  if(enabled){await this.permission();this.schedule({...item,enabled:true});}
  else if(this.api())for(let i=0;i<29;i++)this.api().cancel(item.base+i);
  item.enabled=enabled;this.persist(list);
 },
 remove(id){
  const list=this.list(),item=list.find(x=>x.id===id);
  if(item&&this.api())for(let i=0;i<29;i++)this.api().cancel(item.base+i);
  this.persist(list.filter(x=>x.id!==id));
 },
 refresh(){
  if(!this.api())return;
  for(const item of this.list()){if(!item.enabled)continue;try{this.schedule(item)}catch(e){console.warn("Alarm restoration",e)}}
 }
};

const $=id=>document.getElementById(id);
const preset=[["Actividad física","🚶","green"],["Alimentación","🍴","orange"],["Terapia","♥","purple"],["Salud","💧","blue"],["Sueño","☾","purple"],["Emociones","☁","grey"],["Cognitivo","◉","orange"],["Ocio","▣","blue"],["Trabajo","▣","orange"],["Personal","●","grey"],["Hidratación","💧","blue"],["Descanso","☾","purple"],["Salida","🚶","green"],["Social","♥","purple"]];
const byCategory=name=>preset.find(p=>p[0].toLowerCase()===String(name||"").toLowerCase())||[name||"Personal","✦","grey"];
const unique=a=>[...new Set(a.filter(Boolean))];
const localTime=d=>{const date=new Date(d);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatTime=v=>new Date(v).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
const dayKey=v=>localTime(v).slice(0,10);
let entries=[],current=null,mood=null,selectedCategory="",period="week",previous="capture",recognition=null,quickDate=null,categoryFilter="",editingReminderId=null;
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
function toast(message){const id=$("capture-status");if(id)id.textContent=message;}
function show(page){
    if(page==="edit")previous="history";
    ["capture","history","categories","edit","summary","reminders","data","more"].forEach(s=>$(s).classList.toggle("active",s===page));
    const labels={capture:"Nuevo registro",history:"Historial",categories:"Categorías",edit:"Editar registro",summary:"Resumen",reminders:"Recordatorios",data:"Importar / Exportar",more:"Más"};
    $("title").textContent=labels[page];$("back").classList.toggle("hidden",["capture","history","reminders","more"].includes(page));
    $("top-action").textContent=page==="capture"?"⚙":page==="history"?"⋮":page==="reminders"?"＋":"";
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===page || (page==="edit"&&b.dataset.page==="history") || (["categories","summary","data"].includes(page)&&b.dataset.page==="more")));
    if(page==="history")drawHistory();if(page==="categories")drawCategories();if(page==="summary")drawSummary();if(page==="reminders")drawReminders();
    window.scrollTo(0,0);
}
function iconFor(category){
 const p=byCategory(category), icons={"Actividad física":"walk","Alimentación":"food","Terapia":"heart","Salud":"water","Sueño":"moon","Emociones":"cloud","Cognitivo":"person","Ocio":"book","Trabajo":"briefcase","Personal":"person","Hidratación":"water","Descanso":"moon","Salida":"walk","Social":"heart"};
 const box=el("span","entry-icon "+(p[2]||""));const name=icons[p[0]]||"leaf";
 box.innerHTML='<svg class="icon"><use href="#i-'+name+'"></use></svg>';return box;
}
function categoryOptions(){
 const cats=unique([...preset.map(p=>p[0]),...entries.map(e=>e.category),...customCategories()]);
 const select=$("edit-category");select.replaceChildren(new Option("Sin categoría",""),...cats.map(c=>new Option(c,c)));return cats;
}
function customCategories(){try{return JSON.parse(localStorage.getItem("rh-categories")||"[]")}catch{return []}}
function saveCategory(name){localStorage.setItem("rh-categories",JSON.stringify(unique([...customCategories(),name])))}
function suggestions(){
 const root=$("suggestions");root.replaceChildren();
 for(const [title,emoji] of [["Caminata","🚶"],["Hidratación","💧"],["Comida","🍴"],["Descanso","☾"],["Terapia","♥"],["Trabajo","▣"]]){
  const btn=el("button","suggestion",emoji+" "+title);
  btn.onclick=()=>{const textarea=$("capture-text");if(textarea.value.trim())textarea.value+=" · ";textarea.value+=title;textarea.focus();};
  root.append(btn);
 }
}
async function reload(){entries=await storage.list();drawHistory();drawCategories();drawSummary();}
function openEdit(e){
 current=e;selectedCategory=e.category||"";mood=e.mood??null;
 $("edit-text").value=e.description;$("edit-date").value=dayKey(e.occurredAt);$("edit-time").value=localTime(e.occurredAt).slice(11);
 categoryOptions();$("edit-category").value=e.category||"";
 $("edit-duration").value=e.duration??"";$("edit-notes").value=e.notes||"";
 $("energy-enabled").checked=e.energy!=null;$("edit-energy").value=e.energy??5;$("energy-number").textContent=e.energy??"—";
 document.querySelectorAll("#moods button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.mood)===mood));
 show("edit");
}
function drawHistory(){
 const q=$("search").value.trim().toLocaleLowerCase("es-AR");
 const root=$("history-list");root.replaceChildren();
 const matches=entries.filter(e=>(!categoryFilter||e.category===categoryFilter)&&(!q||[e.description,e.notes,e.category].join(" ").toLocaleLowerCase("es-AR").includes(q)));
 if(!matches.length){root.append(el("p","muted","Todavía no hay registros para mostrar."));return;}
 for(const e of matches){
  const row=el("button","history-item");row.append(iconFor(e.category));
  const body=el("span","item-main");body.append(el("strong","",e.description));
  const small=el("small","",(dayKey(e.occurredAt)===dayKey(Date.now())?"Hoy ":"")+formatTime(e.occurredAt));
  if(e.category){small.append(el("span","pill",e.category));}
  body.append(small);row.append(body);if(e.mood!=null)row.append(el("span","face",e.mood>=7?"●":e.mood<=3?"☹":"●"));
  row.append(el("span","muted","⋮"));row.onclick=()=>openEdit(e);root.append(row);
 }
}
function drawCategories(){
 const root=$("category-list");root.replaceChildren();
 const names=unique([...preset.slice(0,10).map(x=>x[0]),...customCategories(),...entries.map(e=>e.category)]);
 for(const cat of names){const count=entries.filter(e=>e.category===cat).length;const row=el("button","category-item");row.append(iconFor(cat),el("span","item-main",cat),el("span","muted",String(count)));row.onclick=()=>{categoryFilter=cat;$("search").value="";show("history")};root.append(row);}
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
 const countsCat=new Map();entries.forEach(e=>countsCat.set(e.category||"Sin categoría",(countsCat.get(e.category||"Sin categoría")||0)+1));
 const root=$("summary-categories");root.replaceChildren();for(const [cat,count] of [...countsCat].sort((a,b)=>b[1]-a[1])){const row=el("div","category-item");row.append(iconFor(cat),el("span","item-main",cat),el("span","muted",String(count)));root.append(row);}
 $("summary-count").textContent=entries.length+" registros en total";
}
async function saveCapture(){
 const description=$("capture-text").value.trim();if(!description){$("capture-text").focus();return;}
 const choice=suggestCategory(description,entries);const category=selectedCategory||choice?.category||null;
 try{await storage.save({description,occurredAt:quickDate||new Date().toISOString(),category,categorySource:selectedCategory?"manual":choice?"suggested":null,energy:null,mood:null,notes:"",duration:null});
  $("capture-text").value="";selectedCategory="";quickDate=null;toast("Registro guardado.");await reload();show("history");
 }catch(e){toast("Error al guardar: "+e.message)}
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
 const status = $(targetId === "edit-text" ? "edit-voice-status" : "capture-status");
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
   const status = $(targetId === "edit-text" ? "edit-voice-status" : "capture-status");
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
$("capture-save").onclick=saveCapture;$("mic").onclick=()=>startVoice("capture-text");$("edit-dictate").onclick=()=>startVoice("edit-text");
$("today").onclick=()=>{quickDate=new Date().toISOString();toast("Fecha de hoy seleccionada.")};
$("now").onclick=()=>{quickDate=new Date().toISOString();toast("Hora actual seleccionada.")};
$("notes").onclick=()=>{$("capture-text").focus();toast("Escribí tu nota libremente.")};
$("history-filter").onclick=()=>{categoryFilter="";show("categories")};
$("category-add").onclick=()=>{const cat=prompt("Nombre de la categoría");if(cat?.trim()){saveCategory(cat.trim());drawCategories()}};
$("search").oninput=drawHistory;
$("edit-energy").oninput=()=>{$("energy-enabled").checked=true;$("energy-number").textContent=$("edit-energy").value};
$("energy-enabled").onchange=()=>{$("energy-number").textContent=$("energy-enabled").checked?$("edit-energy").value:"—"};
document.querySelectorAll("#moods button").forEach(b=>b.onclick=()=>{mood=Number(b.dataset.mood);document.querySelectorAll("#moods button").forEach(a=>a.classList.toggle("selected",a===b))});
$("edit-save").onclick=async()=>{
 if(!current)return;const description=$("edit-text").value.trim();if(!description){$("edit-text").focus();return;}
 const date=$("edit-date").value,time=$("edit-time").value;if(!date||!time)return;
 try{await storage.save({...current,description,occurredAt:new Date(date+"T"+time+":00").toISOString(),category:$("edit-category").value||null,categorySource:"manual",mood,energy:$("energy-enabled").checked?Number($("edit-energy").value):null,duration:$("edit-duration").value===""?null:Number($("edit-duration").value),notes:$("edit-notes").value});await reload();show("history")}catch(e){alert(e.message)}
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
 suggestions();
 reload().catch(e=>toast("No se pudo abrir la base local: "+e.message));
 try{reminderStore.refresh()}catch(e){console.warn(e)}
}
