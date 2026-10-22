// Classic script for KCAPK file:///android_asset entry points.
// Generated from storage.js, classifier.js and app.js.
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
        const record = { ...entry, id: entry.id || crypto.randomUUID(), createdAt: entry.createdAt || now, updatedAt: now };
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

import { suggestCategory } from "./classifier.js";
const $ = id => document.getElementById(id);
const nowLocal = date => { const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return d.toISOString().slice(0,16); };
let entries = [], editing = null, speech = null, manualCategory = false;
$("date-label").textContent = new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
function show(screen) {
    for(const id of ["home","editor","history"]) $(id).classList.toggle("active",id===screen);
    $("screen-title").textContent = {home:"Mi día",editor:editing?"Editar entrada":"Nueva entrada",history:"Historial"}[screen];
    $("nav-home").classList.toggle("active",screen==="home");
    $("nav-history").classList.toggle("active",screen==="history");
    window.scrollTo(0,0);
}
function openEditor(entry=null) {
    editing = entry?.id || null;
    manualCategory = !!entry?.category;
    $("description").value = entry?.description || "";
    $("category").value = entry?.category || "";
    $("when").value = nowLocal(entry ? new Date(entry.occurredAt) : new Date());
    for(const [name,key] of [["energy","energy"],["mood","mood"]]) {
        $(name).value = entry?.[key] ?? 5;
        $("use-"+name).checked = entry?.[key] != null;
        updateRange(name);
    }
    $("delete").classList.toggle("hidden",!editing);
    $("editor").querySelector("details").open = false;
    $("voice-state").textContent = "";
    show("editor");
    $("description").focus();
}
function updateRange(name){ $(name+"-value").textContent = $("use-"+name).checked ? $(name).value+"/10" : "Sin registrar"; }
["energy","mood"].forEach(name=>{
    $(name).addEventListener("input",()=>{ $("use-"+name).checked=true;updateRange(name); });
    $("use-"+name).addEventListener("change",()=>updateRange(name));
});
$("category").addEventListener("input",()=>{manualCategory=true;});
$("description").addEventListener("input",()=>{
    if(manualCategory) return;
    const suggestion=suggestCategory($("description").value,entries);
    $("category").value=suggestion?.category || "";
});
function renderList(target, items) {
    const root=$(target);root.replaceChildren();
    if(!items.length){const p=document.createElement("p");p.className="empty";p.textContent="Todavía no hay entradas.";root.append(p);return;}
    for(const entry of items){
        const button=document.createElement("button");button.className="entry";
        const time=document.createElement("span");time.className="time";time.textContent=new Date(entry.occurredAt).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
        const content=document.createElement("span");content.className="entry-body";content.textContent=entry.description;
        if(entry.category){const note=document.createElement("small");note.textContent=entry.category;content.append(note);}
        button.append(time,content);button.addEventListener("click",()=>openEditor(entry));root.append(button);
    }
}
function redraw(){
    const cats=[...new Set(entries.map(e=>e.category).filter(Boolean))].sort();
    $("categories").replaceChildren(...cats.map(c=>{const o=document.createElement("option");o.value=c;return o;}));
    const selected=$("filter-category").value;
    $("filter-category").replaceChildren(new Option("Todas",""),...cats.map(c=>new Option(c,c)));
    $("filter-category").value=cats.includes(selected)?selected:"";
    renderList("recent",entries.slice(0,5));
    const q=$("search").value.toLocaleLowerCase("es-AR");
    renderList("all-entries",entries.filter(e=>(!$("filter-category").value||e.category===$("filter-category").value)&&(!q||(e.description+" "+(e.category||"")).toLocaleLowerCase("es-AR").includes(q))));
}
async function reload(){entries=await storage.list();redraw();}
$("record").onclick=()=>openEditor();
$("view-all").onclick=$("nav-history").onclick=$("menu-button").onclick=()=>show("history");
$("nav-home").onclick=()=>show("home");
$("cancel").onclick=()=>{if(speech) speech.stop();show("home");};
$("save").onclick=async()=>{
    const description=$("description").value.trim();if(!description){$("description").focus();return;}
    const original=entries.find(e=>e.id===editing);
    const category=$("category").value.trim()||null;
    const record={
        ...(original||{}),description,occurredAt:new Date($("when").value||Date.now()).toISOString(),
        category,categorySource:category?(manualCategory?"manual":"suggested"):null,
        energy:$("use-energy").checked?Number($("energy").value):null,
        mood:$("use-mood").checked?Number($("mood").value):null
    };
    try{await storage.save(record);await reload();show("home");}
    catch(error){alert("No se pudo guardar la entrada. "+error.message);}
};
$("delete").onclick=async()=>{if(!editing || !confirm("¿Eliminar esta entrada?"))return;await storage.remove(editing);await reload();show("home");};
$("search").oninput=redraw;$("filter-category").onchange=redraw;
function download(filename,content,type){
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("json").onclick=()=>download("registro-habitos.json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2),"application/json");
$("csv").onclick=()=>{
    const cols=["id","occurredAt","createdAt","description","category","categorySource","energy","mood"];
    const quote=s=>'"'+String(s??"").replaceAll('"','""')+'"';
    const lines=[cols.join(","),...entries.map(e=>cols.map(c=>quote(e[c])).join(","))];
    download("registro-habitos.csv","\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
};
$("import-json").onclick=()=> $("import-file").click();
$("import-file").onchange=async event=>{
    const file=event.target.files?.[0];
    if (!file) return;
    try {
        const backup=JSON.parse(await file.text());
        if (!backup || backup.version !== 1 || !Array.isArray(backup.entries)) {
            throw new Error("Formato de respaldo no reconocido.");
        }
        const ids=new Set();
        for (const entry of backup.entries) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
                typeof entry.id !== "string" || !entry.id ||
                ids.has(entry.id) || typeof entry.description !== "string" ||
                !entry.description.trim() || typeof entry.occurredAt !== "string" ||
                !Number.isFinite(Date.parse(entry.occurredAt)) ||
                typeof entry.createdAt !== "string" || !Number.isFinite(Date.parse(entry.createdAt)) ||
                ["energy","mood"].some(key => entry[key] != null &&
                    (!Number.isInteger(entry[key]) || entry[key] < 0 || entry[key] > 10))) {
                throw new Error("El archivo tiene registros duplicados o inválidos.");
            }
            ids.add(entry.id);
        }
        if (!confirm("Importar "+backup.entries.length+" entradas? Las existentes se conservarán; los ID repetidos se omitirán.")) return;
        const result=await storage.importEntries(backup.entries);
        await reload();
        alert("Importadas: "+result.imported+". Omitidas por ID existente: "+result.skipped+".");
    } catch(error) {
        alert("No se pudo importar el archivo: "+error.message);
    } finally {
        event.target.value="";
    }
};
$("dictate").onclick=()=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){$("voice-state").textContent="Dictado no disponible; podés escribir.";return;}
    if(speech){speech.stop();speech=null;return;}
    const recognition=new Recognition();recognition.lang="es-AR";recognition.interimResults=true;
    const baseline=$("description").value.trim();speech=recognition;
    recognition.onresult=event=>{
        let heard="";for(let i=0;i<event.results.length;i++)heard+=event.results[i][0].transcript+" ";
        $("description").value=[baseline,heard.trim()].filter(Boolean).join(" ");
        $("description").dispatchEvent(new Event("input"));
    };
    recognition.onerror=e=>{$("voice-state").textContent="Dictado: "+e.error;};
    recognition.onend=()=>{speech=null;if($("voice-state").textContent==="Escuchando…")$("voice-state").textContent="";};
    $("voice-state").textContent="Escuchando…";recognition.start();
};
reload().catch(e=>{$("recent").textContent="No se pudo abrir el almacenamiento local: "+e.message;});
