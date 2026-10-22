import { storage } from "./storage.js";
import { suggestCategory } from "./classifier.js";
import { categoryStore, ICON_NAMES } from "./categories.js";
const $=id=>document.getElementById(id);
const preset=[["Actividad física","🚶","green"],["Alimentación","🍴","orange"],["Terapia","♥","purple"],["Salud","💧","blue"],["Sueño","☾","purple"],["Emociones","☁","grey"],["Cognitivo","◉","orange"],["Ocio","▣","blue"],["Trabajo","▣","orange"],["Personal","●","grey"],["Hidratación","💧","blue"],["Descanso","☾","purple"],["Salida","🚶","green"],["Social","♥","purple"],["Higiene","✦","blue"],["Ir al baño","🚻","blue"],["Tabaco","♨","orange"],["Vapeo","≈","purple"],["Alcohol","◌","orange"],["Medicación","✚","blue"],["Cafeína","☕","orange"]];
const canonicalCategory=name=>{const raw=String(name||"").trim();return preset.find(p=>p[0].toLowerCase()===raw.toLowerCase())?.[0]||raw};
const byCategory=name=>{const p=categoryStore.get(canonicalCategory(name));return [p.name,"",p.color]};
const unique=a=>[...new Set(a.filter(Boolean))];
const localTime=d=>{const date=new Date(d);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatTime=v=>new Date(v).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
const dayKey=v=>localTime(v).slice(0,10);
let entries=[],current=null,mood=null,period="week",previous="capture",recognition=null,categoryFilter="",editingReminderId=null,quickSaving=false,lastQuickEntryId=null,editingCategory=null,categoryImage=null,categoryIcon="leaf";
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
function toast(message){const id=$("capture-status");if(id)id.textContent=message;}
function show(page){
    
    ["capture","history","categories","summary","reminders","data","more","about"].forEach(s=>$(s).classList.toggle("active",s===page));
    const labels={capture:"Mi día",history:"Historial",categories:"Categorías",summary:"Resumen",reminders:"Recordatorios",data:"Importar / Exportar",more:"Más",about:"Acerca de"};
    $("title").textContent=labels[page];$("back").classList.toggle("hidden",["capture","history","reminders","more"].includes(page));
    // Always render the same bundled SVG icons. Assigning textContent here
    // replaces the initial settings SVG with a font-dependent Unicode gear.
    const headerIcon={capture:"i-gear",history:"i-more-vertical",reminders:"i-plus",categories:"i-plus"}[page];
    const topAction=$("top-action");
    topAction.classList.toggle("hidden",!headerIcon);
    const svgNamespace="http://www.w3.org/2000/svg";
    if(headerIcon){
        const svg=document.createElementNS(svgNamespace,"svg");
        svg.setAttribute("class","icon");
        svg.setAttribute("viewBox","0 0 24 24");
        const use=document.createElementNS(svgNamespace,"use");
        use.setAttribute("href","#"+headerIcon);
        svg.append(use);
        topAction.replaceChildren(svg);
    }else topAction.replaceChildren();
    $("top-action").setAttribute("aria-label",page==="categories"?"Crear categoría":page==="reminders"?"Nuevo recordatorio":page==="capture"?"Más opciones":page==="history"?"Opciones del historial":"Opciones");
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===page || (["categories","summary","data","about"].includes(page)&&b.dataset.page==="more")));
    $("add-entry").classList.toggle("hidden",page!=="capture");
    if(page==="capture")drawDashboard();if(page==="history")drawHistory();if(page==="categories")drawCategories();if(page==="summary")drawSummary();if(page==="reminders")drawReminders();
    window.scrollTo(0,0);
}
function drawLucideIcon(name){
 const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
 icon.setAttribute("class","icon lucide-icon");
 icon.setAttribute("viewBox","0 0 24 24");
 const use=document.createElementNS("http://www.w3.org/2000/svg","use");
 use.setAttribute("href","#li-"+(ICON_NAMES.includes(name)?name:"leaf"));
 icon.append(use);
 return icon;
}
function iconFor(category){
 const p=categoryStore.get(canonicalCategory(category));
 const box=el("span","entry-icon "+p.color);
 if(p.image){
  const image=el("img");image.alt="";image.src=p.image;
  box.append(image);
 }else{box.append(drawLucideIcon(p.icon));}
 return box;
}
function categoryOptions(){
 const cats=categoryNames();
 const select=$("edit-category");select.replaceChildren(new Option("Sin categoría",""),...cats.map(c=>new Option(c,c)));return cats;
}
// App-owned dialogs: WebView alert/confirm/prompt use disruptive Android UI.
// Keep all confirmation and text-entry surfaces in the quiet dark theme.
function showAppDialog({title,message,kind="confirm",ok="Aceptar",danger=false,value=""}){
 return new Promise(resolve=>{
  const dialog=$("app-action-dialog");
  const input=$("app-action-input");
  const isInput=kind==="input",isInfo=kind==="info";
  $("app-action-title").textContent=title;
  $("app-action-message").textContent=message||"";
  $("app-action-message").classList.toggle("hidden",!message);
  $("app-action-input-label").classList.toggle("hidden",!isInput);
  input.value=value;
  $("app-action-ok").textContent=ok;
  $("app-action-ok").classList.toggle("destructive",danger);
  $("app-action-cancel").classList.toggle("hidden",isInfo);
  let settled=false;
  const finish=result=>{
   if(settled)return;
   settled=true;
   dialog.onclose=null;dialog.oncancel=null;
   $("app-action-ok").onclick=null;
   $("app-action-cancel").onclick=null;
   if(dialog.open)dialog.close();
   resolve(result);
  };
  const declined=()=>finish(isInput?null:false);
  $("app-action-ok").onclick=()=>{
   if(isInput&&!input.value.trim()){input.focus();return;}
   finish(isInput?input.value.trim():true);
  };
  $("app-action-cancel").onclick=declined;
  dialog.oncancel=event=>{event.preventDefault();declined();};
  dialog.onclose=declined;
  dialog.showModal();
  if(isInput)input.focus();
 });
}
const appConfirm=(message,title="Confirmar",ok="Aceptar")=>
 showAppDialog({title,message,ok,danger:ok==="Eliminar"});
const appPrompt=(title,value="")=>
 showAppDialog({title,message:"",kind:"input",ok:"Guardar",value});
const appInfo=(message,title="Información")=>
 showAppDialog({title,message,kind:"info",ok:"Cerrar"});
function customCategories(){return categoryStore.names().filter(name=>!preset.some(p=>p[0]===name))}
function saveCategory(name){
 if(!categoryStore.names().includes(name))categoryStore.save({name,keywords:[],icon:"leaf",color:"grey"});
}
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
 return unique([...categoryStore.names(),...entries.map(e=>canonicalCategory(e.category)).filter(name=>name&&!categoryStore.get(name).deleted)]);
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
  category,quickDescription(category),...categoryStore.get(category).keywords
 ].join(" "));
 return terms.every(term=>haystack.includes(term));
}
function drawDashboard(){
 const grid=$("quick-categories");grid.replaceChildren();
 const names=categoryNames().filter(name=>matchesCategorySearch(name,$("category-search").value));
 if(!names.length)grid.append(el("p","category-no-results","No hay categorías que coincidan."));
 for(const category of names){
  const button=el("button","quick-category");
  button.type="button";button.setAttribute("aria-label","Nueva entrada de "+category);
  const badge=iconFor(category);badge.setAttribute("aria-hidden","true");
  button.append(badge,el("span","quick-name",category));
  button.onclick=()=>openEntryDialog(category);
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
  body.append(el("strong","",entry.description),el("small","",formatTime(entry.occurredAt)+(entry.duration!=null?" · "+durationLabel(entry.duration):"")));
  button.append(body);button.onclick=()=>openEdit(entry);recent.append(button);
 }
}
function showCaptureFeedback(message,entry=null){
 $("quick-feedback").classList.toggle("has-message",Boolean(message));
 $("capture-status").textContent=message;
 lastQuickEntryId=entry?.id||null;
 $("undo-quick").classList.toggle("hidden",!entry);
}
// Canonical duration is stored in minutes. Explicit intervals also retain
// both endpoints for later analysis; neither requires a database migration.
// duration is always stored as total minutes. Hours and minutes are
// convenience inputs; explicit start/end are retained only when provided.
// Duration is stored as optional total minutes; historical interval data
// is preserved when an existing record is edited without changing duration.
function durationLabel(total){
 const n=Number(total);
 if(!Number.isFinite(n))return "";
 const h=Math.floor(n/60),m=n%60;
 return h?(h+" h"+(m?" "+m+" min":"")):(m+" min");
}
function populateDurationParts(prefix,total){
 const hours=$(prefix+"-hours"),minutes=$(prefix+"-minutes");
 if(total==null||total===""){hours.value="";minutes.value="";return;}
 const n=Number(total);
 if(!Number.isInteger(n)||n<0){hours.value="";minutes.value="";return;}
 hours.value=String(Math.floor(n/60));minutes.value=String(n%60);
}
function updateDurationFromParts(prefix){
 const h=$(prefix+"-hours").value.trim(),m=$(prefix+"-minutes").value.trim();
 if(h===""&&m===""){$(prefix+"-duration").value="";return;}
 const hours=h===""?0:Number(h),minutes=m===""?0:Number(m);
 if(!Number.isInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59){
  $(prefix+"-duration").value="";return;
 }
 $(prefix+"-duration").value=String(hours*60+minutes);
}
function durationDetails(prefix){
 const h=$(prefix+"-hours").value.trim(),m=$(prefix+"-minutes").value.trim();
 let duration=null;
 if(h!==""||m!==""){
  const hours=h===""?0:Number(h),minutes=m===""?0:Number(m);
  if(!Number.isInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59)
   throw Error("Usá horas positivas y minutos entre 0 y 59.");
  duration=hours*60+minutes;
 }
 $(prefix+"-duration").value=duration==null?"":String(duration);
 const source=prefix==="entry"?$("entry-when").value:$("edit-date").value+"T"+$("edit-time").value;
 if(!source||!Number.isFinite(new Date(source).getTime()))throw Error("Ingresá una fecha y hora válidas.");
 return {occurredAt:new Date(source).toISOString(),duration,startedAt:null,endedAt:null};
}
function createEntry(details){
 return {
  description:details.description,occurredAt:details.occurredAt,
  category:details.category||null,categorySource:details.categorySource||null,
  energy:details.energy??null,mood:details.mood??null,
  duration:details.duration??null,startedAt:details.startedAt||null,endedAt:details.endedAt||null,notes:details.notes||""
 };
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
 populateDurationParts("entry",null);
 $("entry-options").open=false;
}
function openEntryDialog(category=null){
 resetEntryOptions();
 const chosen=canonicalCategory(category);
 $("entry-dialog-title").textContent=chosen?"Registrar · "+chosen:"Nueva entrada";
 $("entry-category").value=chosen||"";
 const preview=$("entry-category-preview");
 preview.classList.toggle("hidden",!chosen);
 preview.textContent=chosen?"Categoría: "+chosen:"";
 // A category button prepares an editable one-tap template, but never saves
 // until the person explicitly confirms with Guardar.
 if(chosen)$("capture-text").value=quickDescription(chosen);
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
 populateDurationParts("edit",e.duration);
 $("energy-enabled").checked=e.energy!=null;$("edit-energy").value=e.energy??5;$("energy-number").textContent=e.energy??"—";
 document.querySelectorAll("#moods button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.mood)===mood));
 $("edit-voice-status").textContent="";
 $("edit-dialog").showModal();
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
  if(e.duration!=null)small.append(document.createTextNode(" · "+durationLabel(e.duration)));
  body.append(small);row.append(body);if(e.mood!=null)row.append(el("span","face",e.mood>=7?"●":e.mood<=3?"☹":"●"));
  row.type="button";row.setAttribute("aria-label","Editar registro: "+e.description);row.onclick=()=>openEdit(e);root.append(row);
 }
}
function drawCategories(){
 const root=$("category-list");root.replaceChildren();
 for(const cat of categoryNames()){
  const p=categoryStore.get(cat),count=entries.filter(e=>canonicalCategory(e.category)===cat).length;
  const row=el("div","category-item");
  const main=el("span","item-main");
  main.append(el("strong","",cat));
  main.append(el("small","category-detail",p.keywords.slice(0,4).join(" · ")||"Sin palabras clave"));
  const open=el("button","category-open");
  open.type="button";open.setAttribute("aria-label","Editar categoría: "+cat);
  open.append(iconFor(cat),main);
  open.onclick=()=>openCategoryEditor(cat);
  const remove=el("button","category-remove","×");
  remove.type="button";remove.setAttribute("aria-label","Eliminar "+cat);remove.onclick=()=>deleteCategory(cat,count);
  row.append(open,el("span","category-count",String(count)),remove);
  root.append(row);
 }
 if(!root.children.length)root.append(el("p","muted","No hay categorías. Agregá una con +."));
}
function updateCategoryPreview(){
 const box=$("cat-icon-preview");box.replaceChildren();
 box.className="entry-icon "+$("cat-color").value;
 if(categoryImage){
  const image=el("img");image.src=categoryImage;image.alt="";box.append(image);
 }else box.append(drawLucideIcon(categoryIcon));
 $("cat-image-clear").classList.toggle("hidden",!categoryImage);
 for(const item of $("cat-icon-grid").children){
  const isSelected=item.dataset.icon===categoryIcon&&!categoryImage;
  item.classList.toggle("selected",isSelected);
  item.setAttribute("aria-pressed",isSelected?"true":"false");
 }
}
function openCategoryEditor(category=null){
 editingCategory=category;
 const profile=category?categoryStore.get(category):null;
 $("category-dialog-title").textContent=category?"Editar categoría":"Nueva categoría";
 $("cat-name").value=profile?.name||"";
 $("cat-keywords").value=(profile?.keywords||[]).join(", ");
 $("cat-color").value=profile?.color||"green";
 $("cat-error").textContent="";
 $("cat-image").value="";
 categoryImage=profile?.image||null;
 categoryIcon=profile?.icon||"leaf";
 const grid=$("cat-icon-grid");grid.replaceChildren();
 for(const name of ICON_NAMES){
  const button=el("button");button.type="button";button.dataset.icon=name;
  button.setAttribute("aria-label","Ícono "+name);button.title=name;
  button.append(drawLucideIcon(name));
  button.onclick=()=>{categoryIcon=name;categoryImage=null;updateCategoryPreview();};
  grid.append(button);
 }
 updateCategoryPreview();
 $("category-dialog").showModal();
}
async function deleteCategory(name,count){
 if(!await appConfirm("¿Eliminar «"+name+"» de las categorías?"+(count?" Sus "+count+" registros anteriores se conservarán en el historial.":""),"Eliminar categoría","Eliminar"))return;
 categoryStore.remove(name);
 await reload();
}
async function saveCategoryEditor(){
 const save=$("cat-save");save.disabled=true;$("cat-error").textContent="";
 try{
  const original=editingCategory;
  const name=$("cat-name").value.trim().replace(/\s+/g," ");
  if(!name||name.length>64)throw Error("Ingresá un nombre de hasta 64 caracteres.");
  const words=$("cat-keywords").value.split(/[,\n;]/).map(x=>x.trim()).filter(Boolean);
  // Rename the historical entries first; category definitions continue
  // governing the display of existing records without losing entry content.
  if(original&&original!==name&&categoryNames().some(x=>x.toLocaleLowerCase("es-AR")===name.toLocaleLowerCase("es-AR")))
   throw Error("Ya existe una categoría con ese nombre.");
  categoryStore.save({
   name,keywords:words,icon:categoryIcon,image:categoryImage,color:$("cat-color").value
  },original);
  if(original&&name!==original){
   for(const entry of entries.filter(e=>canonicalCategory(e.category)===original)){
    await storage.save({...entry,category:name});
   }
  }
  $("category-dialog").close();
  categoryFilter=categoryFilter===original?name:categoryFilter;
  await reload();
 }catch(error){$("cat-error").textContent=error.message;}
 finally{save.disabled=false;}
}
function readCategoryImage(file){
 return new Promise((resolve,reject)=>{
  if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type))return reject(Error("Elegí una imagen PNG, JPG o WebP."));
  if(file.size>8*1024*1024)return reject(Error("La imagen debe ocupar menos de 8 MB."));
  const reader=new FileReader();
  reader.onerror=()=>reject(Error("No se pudo abrir la imagen."));
  reader.onload=()=>{
   const image=new Image();
   image.onerror=()=>reject(Error("El archivo no contiene una imagen válida."));
   image.onload=()=>{
    try{
     const side=192,canvas=document.createElement("canvas");canvas.width=side;canvas.height=side;
     const ctx=canvas.getContext("2d");if(!ctx)throw Error("No se pudo procesar la imagen.");
     const scale=Math.max(side/image.width,side/image.height);
     ctx.drawImage(image,(side-image.width*scale)/2,(side-image.height*scale)/2,image.width*scale,image.height*scale);
     const result=canvas.toDataURL("image/webp",0.73);
     if(!result.startsWith("data:image/webp;"))throw Error("No se pudo comprimir la imagen.");
     if(result.length>240000)throw Error("La imagen comprimida sigue siendo demasiado grande.");
     resolve(result);
    }catch(error){reject(error);}
   };
   image.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
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
 let timing;
 try{timing=durationDetails("entry");}
 catch(error){$("entry-status").textContent=error.message;return;}
 const manual=canonicalCategory($("entry-category").value);
 const suggested=manual?null:suggestCategory(description,entries,null,categoryStore.list());
 const predicted=canonicalCategory(suggested?.category);
 const category=manual||(predicted&&!categoryStore.get(predicted).deleted?predicted:null);
 quickSaving=true;
 $("capture-save").disabled=true;
 try{
  const record=await storage.save(createEntry({
   description,...timing,category,
   categorySource:manual?"manual":suggested?.source||null,
   energy:$("entry-energy-enabled").checked?Number($("entry-energy").value):null,
   mood:$("entry-mood-enabled").checked?Number($("entry-mood").value):null,
   notes:$("entry-notes").value.trim()
  }));
  closeEntryDialog();await reload();
  showCaptureFeedback("Entrada guardada · "+formatTime(record.occurredAt),record);
 }catch(error){$("entry-status").textContent="No se pudo guardar: "+error.message;}
 finally{quickSaving=false;$("capture-save").disabled=false;}
}
function csv(){const cols=["id","occurredAt","startedAt","endedAt","createdAt","updatedAt","description","category","categorySource","energy","mood","duration","notes"];const esc=x=>'"'+String(x??"").replaceAll('"','""')+'"';return "\uFEFF"+[cols.join(","),...entries.map(e=>cols.map(k=>esc(e[k])).join(","))].join("\r\n")}
function download(name,text,type){const share=window.NativeBridge?.Android?.intents?.share;if(share){const ok=share({text,subject:name,title:name,chooserTitle:"Compartir datos",type:"text/plain"});if(ok)return;}const url=URL.createObjectURL(new Blob([text],{type}));const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function openReminderDialog(item=null){
 editingReminderId=item?.id||null;
 $("reminder-dialog-title").textContent=item?"Editar recordatorio":"Nuevo recordatorio";
 $("reminder-name").value=item?.title||"";
 $("reminder-time").value=item?.time||"13:00";
 $("reminder-repeat").value=item?.repeat||(item?.daily?"daily":"once");
 $("reminder-sound").value=item?.sound||"glock";
 $("reminder-dialog-status").textContent="";
 $("reminder-confirm").textContent=item?"Guardar cambios":"Guardar";
 $("reminder-delete").classList.toggle("hidden",!item);
 $("reminder-dialog").showModal();
}
function drawReminders(){
 const root=$("reminder-list");root.replaceChildren();
 const items=reminderStore.list();
 for(const item of items){
  const row=el("div","reminder-item");
  const open=el("button","reminder-open");
  open.type="button";open.setAttribute("aria-label","Editar recordatorio: "+item.title);
  open.onclick=()=>openReminderDialog(item);
  open.append(iconFor(item.title.toLowerCase().includes("agua")?"Salud":item.title.toLowerCase().includes("dorm")?"Sueño":"Personal"));
  const body=el("span","item-main");
  body.append(el("strong","",item.title),el("small","",item.time+" · "+(item.repeat==="weekdays"?"Lun a vie":item.daily?"Todos los días":"Una vez")));
  open.append(body);row.append(open);
  const toggle=el("button",item.enabled===false?"":"on",item.enabled===false?"○":"●");
  toggle.type="button";toggle.setAttribute("aria-label",item.enabled===false?"Activar":"Desactivar");
  toggle.onclick=async()=>{try{await reminderStore.setEnabled(item.id,item.enabled===false);drawReminders();$("reminder-status").textContent=reminderStore.status()}catch(e){$("reminder-status").textContent=e.message}};
  row.append(toggle);root.append(row);
 }
 if(!items.length)root.append(el("p","muted","Todavía no hay recordatorios."));
}
async function importBackup(file){
 const backup=JSON.parse(await file.text());if(backup.version!==1||!Array.isArray(backup.entries))throw Error("Formato JSON incompatible");
 const ids=new Set();for(const e of backup.entries){if(!e||typeof e.id!=="string"||ids.has(e.id)||typeof e.description!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||!Number.isFinite(Date.parse(e.createdAt)))throw Error("Entrada inválida en el archivo");ids.add(e.id);}
 if(!await appConfirm("Importar "+backup.entries.length+" entradas sin sobrescribir los registros existentes.","Importar datos","Importar"))return;
 const n=await storage.importEntries(backup.entries);
 if(backup.categoryProfiles)categoryStore.merge(backup.categoryProfiles);
 if(Array.isArray(backup.categories))for(const cat of backup.categories){if(typeof cat==="string"&&cat.trim())saveCategory(cat.trim());}
 await reload();
 let notice="Importadas "+n.imported+" entradas. "+n.skipped+" ya existían.";
 if(Array.isArray(backup.reminders)&&backup.reminders.length){
  const existing=new Set(reminderStore.list().map(r=>r.title+"|"+r.time+"|"+r.repeat));
  const add=backup.reminders.filter(r=>r&&typeof r.title==="string"&&/^[0-2][0-9]:[0-5][0-9]$/.test(r.time)&&!existing.has(r.title+"|"+r.time+"|"+r.repeat));
  if(add.length&&await appConfirm("El respaldo incluye "+add.length+" recordatorios nuevos. ¿Querés programarlos en este dispositivo?","Restaurar recordatorios","Programar")){
   let done=0;
   for(const r of add){
    try{const item=await reminderStore.add(r.title,r.time,r.repeat!=="once",r.repeat||"daily",r.sound||"none");if(r.enabled===false)await reminderStore.setEnabled(item.id,false);done++;}
    catch(err){notice+=" Algunos recordatorios no pudieron programarse: "+err.message;break;}
   }
   notice+=" Recordatorios restaurados: "+done+".";
  }
 }
 await appInfo(notice,"Importación completada");
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
// Android back is always consumed here: close the topmost modal, leave an
// auxiliary screen for Mi día, or request confirmation before exiting.
let exitConfirmationOpen=false;
function handleDeviceBack(){
 const action=$("app-action-dialog");
 if(action.open){
  action.dispatchEvent(new Event("cancel",{cancelable:true}));
  return true;
 }
 const openDialogs=[...document.querySelectorAll("dialog[open]")];
 if(openDialogs.length){
  const dialog=openDialogs[openDialogs.length-1];
  if(dialog.id==="entry-dialog")closeEntryDialog();
  else dialog.close();
  return true;
 }
 const page=document.querySelector(".screen.active")?.id;
 if(["categories","summary","data","about"].includes(page)){
  show("more");
  return true;
 }
 if(page!=="capture"){
  show("capture");
  return true;
 }
 if(!exitConfirmationOpen){
  exitConfirmationOpen=true;
  showAppDialog({title:"Salir de la app",message:"¿Querés salir de Registro Hábitos?",ok:"Salir"}).then(leave=>{
   exitConfirmationOpen=false;
   if(leave)window.AppNavigation?.exitApp();
  });
 }
 return true;
}
window.registroHabitosBack=handleDeviceBack;
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>show(b.dataset.page));
$("back").onclick=handleDeviceBack;
$("top-action").onclick=()=>{
 const page=document.querySelector(".screen.active").id;
 if(page==="categories")openCategoryEditor();
 else if(page==="reminders")openReminderDialog();
 else show(page==="capture"?"more":"data");
};
$("category-search").addEventListener("input",drawDashboard);
$("add-entry").onclick=()=>openEntryDialog();
$("edit-close").onclick=()=>$("edit-dialog").close();
$("edit-cancel").onclick=()=>$("edit-dialog").close();
$("edit-dialog").addEventListener("close",()=>{if(recognition){try{recognition.stop()}catch(_){}}});
$("entry-close").onclick=closeEntryDialog;
$("entry-cancel").onclick=closeEntryDialog;
$("entry-dialog").addEventListener("close",()=>{if(recognition){try{recognition.stop()}catch(_){}}});
$("capture-save").onclick=saveCapture;
$("mic").onclick=()=>startVoice("capture-text");
$("edit-dictate").onclick=()=>startVoice("edit-text");
$("dismiss-feedback").onclick=()=>showCaptureFeedback("");
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
$("category-dialog-close").onclick=()=>$("category-dialog").close();
$("cat-cancel").onclick=()=>$("category-dialog").close();
$("cat-color").onchange=updateCategoryPreview;
$("cat-save").onclick=saveCategoryEditor;
$("cat-image-clear").onclick=()=>{categoryImage=null;$("cat-image").value="";updateCategoryPreview()};
$("cat-image").onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 $("cat-error").textContent="";
 try{categoryImage=await readCategoryImage(file);updateCategoryPreview();}
 catch(error){$("cat-error").textContent=error.message;}
};
$("search").oninput=drawHistory;
for(const prefix of ["entry","edit"]){
 for(const field of ["hours","minutes"]){
  $(prefix+"-"+field).addEventListener("input",()=>updateDurationFromParts(prefix));
 }
}
$("edit-energy").oninput=()=>{$("energy-enabled").checked=true;$("energy-number").textContent=$("edit-energy").value};
$("energy-enabled").onchange=()=>{$("energy-number").textContent=$("energy-enabled").checked?$("edit-energy").value:"—"};
document.querySelectorAll("#moods button").forEach(b=>b.onclick=()=>{mood=Number(b.dataset.mood);document.querySelectorAll("#moods button").forEach(a=>a.classList.toggle("selected",a===b))});
$("edit-save").onclick=async()=>{
 if(!current)return;
 const description=$("edit-text").value.trim();if(!description){$("edit-text").focus();return;}
 try{
  const timing=durationDetails("edit");
  // Avoid losing original start/end metadata if the time and duration are
  // unchanged while editing an older record.
  if(current.startedAt&&current.endedAt&&timing.duration===current.duration&&
     Math.abs(Date.parse(timing.occurredAt)-Date.parse(current.occurredAt))<60000){
   timing.startedAt=current.startedAt;timing.endedAt=current.endedAt;
  }
  await storage.save({
   ...current,...timing,description,
   category:canonicalCategory($("edit-category").value)||null,
   categorySource:"manual",mood,
   energy:$("energy-enabled").checked?Number($("edit-energy").value):null,
   notes:$("edit-notes").value
  });
  $("edit-dialog").close();
  await reload();
 }catch(error){await appInfo(error.message,"No se pudieron guardar los cambios");}
};
$("edit-delete").onclick=async()=>{
 if(!current||!await appConfirm("¿Eliminar este registro?","Eliminar registro","Eliminar"))return;
 try{await storage.remove(current.id);$("edit-dialog").close();await reload()}
 catch(error){await appInfo(error.message,"No se pudo eliminar")}
};
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
$("test-closed-notification").onclick=async()=>{
 const button=$("test-closed-notification");
 button.disabled=true;
 $("reminder-dialog-status").textContent="";
 try{
  const exact=await reminderStore.testClosed($("reminder-name").value.trim(),$("reminder-sound").value);
  $("reminder-dialog-status").textContent=exact
   ?"Prueba programada. Cerrá la app normalmente; Android entregará una notificación."
   :"Prueba programada con horario aproximado. Para mejorar la precisión, permití Alarmas y recordatorios en Android.";
 }catch(error){$("reminder-dialog-status").textContent=error.message;}
 finally{button.disabled=false;}
};
$("test-notification").onclick=async()=>{
 const button=$("test-notification");
 button.disabled=true;
 $("reminder-dialog-status").textContent="";
 try{
  await reminderStore.test($("reminder-name").value.trim()||"Prueba de recordatorio",$("reminder-sound").value);
  $("reminder-dialog-status").textContent="Notificación enviada a Android. Comprobá el volumen de notificaciones.";
 }catch(error){$("reminder-dialog-status").textContent=error.message;}
 finally{button.disabled=false;}
};

$("reminder-confirm").onclick=async e=>{
 e.preventDefault();
 const title=$("reminder-name").value.trim(),time=$("reminder-time").value,repeat=$("reminder-repeat").value,sound=$("reminder-sound").value;
 if(!title||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)){
  $("reminder-dialog-status").textContent="Escribí un nombre y una hora válida.";return;
 }
 try{
  if(editingReminderId)await reminderStore.update(editingReminderId,{title,time,repeat,daily:repeat!=="once",sound});
  else await reminderStore.add(title,time,repeat!=="once",repeat,sound);
  $("reminder-dialog").close();
  $("reminder-status").textContent=(editingReminderId?"Recordatorio actualizado.":"Recordatorio guardado.")+(reminderStore.status()?" "+reminderStore.status():"");
  editingReminderId=null;drawReminders();
 }catch(err){$("reminder-dialog-status").textContent=err.message}
};
$("reminder-delete").onclick=async()=>{
 if(!editingReminderId||!await appConfirm("¿Eliminar este recordatorio?","Eliminar recordatorio","Eliminar"))return;
 reminderStore.remove(editingReminderId);
 editingReminderId=null;$("reminder-dialog").close();drawReminders();
 $("reminder-status").textContent="Recordatorio eliminado.";
};
$("export-json").onclick=()=>download("registro-habitos.json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries,reminders:reminderStore.list(),categories:customCategories(),categoryProfiles:categoryStore.export()},null,2),"application/json");
$("export-csv").onclick=()=>download("registro-habitos.csv",csv(),"text/csv;charset=utf-8");
$("import-json").onclick=()=>{if(window.NativeBridge?.Android?.clipboard){const copied=window.NativeBridge.Android.clipboard.get();if(copied?.trim().startsWith("{")){$("import-text").value=copied;$("import-dialog").showModal();return;}}$("import-file").click();};
$("import-text-btn").onclick=()=>{$("import-dialog").showModal();};
$("import-cancel").onclick=()=>$("import-dialog").close();
$("import-confirm").onclick=async()=>{
 try{const content=$("import-text").value;await importBackup({text:async()=>content});$("import-dialog").close();$("import-text").value="";}
 catch(e){await appInfo("No se pudo importar: "+e.message,"Error de importación");}
};
$("import-file").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{await importBackup(file)}
 catch(error){await appInfo("No se pudo importar: "+error.message,"Error de importación")}
 finally{e.target.value=""}
};
const reducedMotionInput=$("reduced-motion");
const reducedMotionKey="registro-habitos-reduced-motion";
try{
 const stored=localStorage.getItem(reducedMotionKey);
 if(stored!==null)reducedMotionInput.checked=stored==="true";
}catch(error){console.warn("Sensory preference unavailable",error);}
document.documentElement.classList.toggle("reduce-motion",reducedMotionInput.checked);
reducedMotionInput.onchange=()=>{
 document.documentElement.classList.toggle("reduce-motion",reducedMotionInput.checked);
 try{localStorage.setItem(reducedMotionKey,String(reducedMotionInput.checked));}
 catch(error){console.warn("Unable to save sensory preference",error);}
};
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
 const buildMeta=document.querySelector('meta[name="app-build"]')?.content || "desarrollo";
 const versionMeta=document.querySelector('meta[name="app-version"]')?.content || "desarrollo";
 const codeMeta=document.querySelector('meta[name="app-version-code"]')?.content || "";
 $("about-version").textContent=versionMeta.startsWith("@")?"desarrollo":versionMeta+(codeMeta&&!codeMeta.startsWith("@")?" ("+codeMeta+")":"");
 $("about-build").textContent=buildMeta.startsWith("@")?"desarrollo":buildMeta;
 reload().catch(e=>toast("No se pudo abrir la base local: "+e.message));
 try{reminderStore.refresh()}catch(e){console.warn(e)}
}
