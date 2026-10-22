import { storage } from "./storage.js";
import { suggestCategory } from "./classifier.js";
const $=id=>document.getElementById(id);
const preset=[["Actividad física","🚶","green"],["Alimentación","🍴","orange"],["Terapia","♥","purple"],["Salud","💧","blue"],["Sueño","☾","purple"],["Emociones","☁","grey"],["Cognitivo","◉","orange"],["Ocio","▣","blue"],["Trabajo","▣","orange"],["Personal","●","grey"],["Hidratación","💧","blue"],["Descanso","☾","purple"],["Salida","🚶","green"],["Social","♥","purple"]];
const byCategory=name=>preset.find(p=>p[0].toLowerCase()===String(name||"").toLowerCase())||[name||"Personal","✦","grey"];
const unique=a=>[...new Set(a.filter(Boolean))];
const localTime=d=>{const date=new Date(d);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatTime=v=>new Date(v).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
const dayKey=v=>localTime(v).slice(0,10);
let entries=[],current=null,mood=null,selectedCategory="",period="week",previous="capture",recognition=null,quickDate=null,categoryFilter="";
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
function iconFor(category){const p=byCategory(category);return el("span","entry-icon "+(p[2]||""),p[1]);}
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
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function drawReminders(){
 const root=$("reminder-list");root.replaceChildren();const items=reminderStore.list();
 for(const item of items){const row=el("div","reminder-item");row.append(iconFor(item.title.toLowerCase().includes("agua")?"Salud":item.title.toLowerCase().includes("dorm")?"Sueño":"Personal"));
  const body=el("span","item-main");body.append(el("strong","",item.title),el("small","",item.time+" · "+(item.repeat==="weekdays"?"Lun a vie":item.daily?"Todos los días":"Una vez")));row.append(body);
  const toggle=el("button",item.enabled===false?"":"on",item.enabled===false?"○":"●");toggle.setAttribute("aria-label",item.enabled===false?"Activar":"Desactivar");toggle.onclick=async()=>{try{await reminderStore.setEnabled(item.id,item.enabled===false);drawReminders()}catch(e){$("reminder-status").textContent=e.message}};
  const remove=el("button","","⋮");remove.onclick=()=>{if(confirm("¿Eliminar este recordatorio?")){reminderStore.remove(item.id);drawReminders()}};row.append(toggle,remove);root.append(row);
 }
 if(!items.length)root.append(el("p","muted","Todavía no hay recordatorios."));
}
async function importBackup(file){
 const backup=JSON.parse(await file.text());if(backup.version!==1||!Array.isArray(backup.entries))throw Error("Formato JSON incompatible");
 const ids=new Set();for(const e of backup.entries){if(!e||typeof e.id!=="string"||ids.has(e.id)||typeof e.description!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||!Number.isFinite(Date.parse(e.createdAt)))throw Error("Entrada inválida en el archivo");ids.add(e.id);}
 if(!confirm("Importar "+backup.entries.length+" entradas? No se sobrescribirán las actuales."))return;
 const n=await storage.importEntries(backup.entries);await reload();alert("Importadas "+n.imported+" entradas. "+n.skipped+" ya existían.");
}
function startVoice(){
 const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Rec||!("processLocally" in Rec.prototype)){toast("No hay reconocimiento de voz local. Podés escribir.");$("capture-text").focus();return;}
 if(recognition){recognition.stop();recognition=null;return;}
 const r=new Rec();r.lang="es-AR";r.interimResults=true;r.processLocally=true;const existing=$("capture-text").value.trim();
 r.onresult=event=>{let t="";for(let i=0;i<event.results.length;i++)t+=event.results[i][0].transcript+" ";$("capture-text").value=[existing,t.trim()].filter(Boolean).join(" ")};
 r.onerror=e=>toast("Micrófono: "+e.error);r.onend=()=>{recognition=null};recognition=r;r.start();toast("Escuchando…");
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>show(b.dataset.page));
$("back").onclick=()=>show(["categories","summary","data"].includes(document.querySelector(".screen.active").id)?"more":"history");
$("top-action").onclick=()=>{const page=document.querySelector(".screen.active").id;if(page==="reminders")$("reminder-dialog").showModal();else show(page==="capture"?"more":"data")};
$("capture-save").onclick=saveCapture;$("mic").onclick=startVoice;
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
$("reminder-new").onclick=()=>$("reminder-dialog").showModal();
$("reminder-confirm").onclick=async e=>{e.preventDefault();const title=$("reminder-name").value.trim(),time=$("reminder-time").value,repeat=$("reminder-repeat").value,sound=$("reminder-sound").value;if(!title||!time)return;
 try{await reminderStore.add(title,time,repeat!=="once",repeat,sound);$("reminder-dialog").close();$("reminder-name").value="";drawReminders();$("reminder-status").textContent="Recordatorio guardado."}catch(err){$("reminder-status").textContent=err.message}
};
$("export-json").onclick=()=>download("registro-habitos.json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries,reminders:reminderStore.list(),categories:customCategories()},null,2),"application/json");
$("export-csv").onclick=()=>download("registro-habitos.csv",csv(),"text/csv;charset=utf-8");
$("import-json").onclick=()=>$("import-file").click();
$("import-file").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{await importBackup(file)}catch(err){alert("No se pudo importar: "+err.message)}finally{e.target.value=""}};
$("reduced-motion").onchange=e=>{document.documentElement.classList.toggle("reduce-motion",e.target.checked)};
suggestions();reload().catch(e=>toast("No se pudo abrir la base local: "+e.message));
