/**
 * app.js - Habit register interface.
 * Summary: Coordinates the browser interface for habit entries.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

import { storage } from "./storage.js";
import { suggestCategory } from "./classifier.js";
import { categoryStore, ICON_NAMES } from "./categories.js";

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const $=id=>document.getElementById(id);
const preset=[["Actividad física","🚶","green"],["Alimentación","🍴","orange"],["Terapia","♥","purple"],["Salud","💧","blue"],["Sueño","☾","purple"],["Emociones","☁","grey"],["Cognitivo","◉","orange"],["Ocio","▣","blue"],["Trabajo","▣","orange"],["Personal","●","grey"],["Hidratación","💧","blue"],["Descanso","☾","purple"],["Salida","🚶","green"],["Social","♥","purple"],["Higiene","✦","blue"],["Ir al baño","🚻","blue"],["Tabaco","♨","orange"],["Vapeo","≈","purple"],["Alcohol","◌","orange"],["Medicación","✚","blue"],["Cafeína","☕","orange"]];

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const canonicalCategory=name=>{const raw=String(name||"").trim();return preset.find(p=>p[0].toLowerCase()===raw.toLowerCase())?.[0]||raw};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const byCategory=name=>{const p=categoryStore.get(canonicalCategory(name));return [p.name,"",p.color]};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const unique=a=>[...new Set(a.filter(Boolean))];

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const localTime=d=>{const date=new Date(d);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const formatTime=v=>new Date(v).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const dayKey=v=>localTime(v).slice(0,10);
let entries=[],current=null,mood=null,period="week",previous="capture",recognition=null,categoryFilter="",editingReminderId=null,quickSaving=false,lastQuickEntryId=null,editingCategory=null,categoryImage=null,categoryIcon="leaf";

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function toast(message){const id=$("capture-status");if(id)id.textContent=message;}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function show(page){
    if(voiceSession || voicePending)stopVoice();
    
    ["capture","history","categories","summary","reminders","backup","analysis","more","about","help"].forEach(s=>$(s).classList.toggle("active",s===page));
    const labels={capture:"Registro de Hábitos",history:"Historial",categories:"Categorías",summary:"Resumen",reminders:"Recordatorios",backup:"Respaldo y restauración",analysis:"Exportar para análisis",more:"Más",about:"Acerca de",help:"Ayuda"};
    $("title").textContent=labels[page];$("back").classList.toggle("hidden",page==="capture");
    $("home-app-icon").classList.toggle("hidden",page!=="capture");
    const headerIcon={capture:"i-help",history:"i-more-vertical",reminders:"i-plus",categories:"i-plus"}[page];
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
    $("top-action").setAttribute("aria-label",page==="categories"?"Crear categoría":page==="reminders"?"Nuevo recordatorio":page==="capture"?"Ayuda":page==="history"?"Opciones del historial":"Opciones");
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===page || (["categories","summary","backup","analysis","about"].includes(page)&&b.dataset.page==="more")));
    $("add-entry").classList.toggle("hidden",page!=="capture");
    if(page==="capture")drawDashboard();if(page==="history")drawHistory();if(page==="categories")drawCategories();if(page==="summary")drawSummary();if(page==="reminders")drawReminders();
    window.scrollTo(0,0);
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function drawLucideIcon(name){
    const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
    icon.setAttribute("class","icon lucide-icon");
    icon.setAttribute("viewBox","0 0 24 24");
    const use=document.createElementNS("http://www.w3.org/2000/svg","use");
    use.setAttribute("href","#li-"+(ICON_NAMES.includes(name)?name:"leaf"));
    icon.append(use);
    return icon;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function iconFor(category){
    const p=categoryStore.get(canonicalCategory(category));
    const box=el("span","entry-icon "+p.color);
    if(p.image){
        const image=el("img");image.alt="";image.src=p.image;
        box.append(image);
    }else{box.append(drawLucideIcon(p.icon));}
    return box;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function categoryOptions(){
    const cats=categoryNames();
    const select=$("edit-category");select.replaceChildren(new Option("Sin categoría",""),...cats.map(c=>new Option(c,c)));return cats;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
        const finish=result=>{
            if(settled)return;
            settled=true;
            dialog.onclose=null;dialog.oncancel=null;
            $("app-action-ok").onclick=null;
            $("app-action-cancel").onclick=null;
            if(dialog.open)dialog.close();
            resolve(result);
        };

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const appConfirm=(message,title="Confirmar",ok="Aceptar")=>
    showAppDialog({title,message,ok,danger:ok==="Eliminar"});

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const appPrompt=(title,value="")=>
    showAppDialog({title,message:"",kind:"input",ok:"Guardar",value});

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const appInfo=(message,title="Información")=>
    showAppDialog({title,message,kind:"info",ok:"Cerrar"});

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function customCategories(){return categoryStore.names().filter(name=>!preset.some(p=>p[0]===name))}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function saveCategory(name){
    if(!categoryStore.names().includes(name))categoryStore.save({name,keywords:[],icon:"leaf",color:"grey"});
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function quickDescription(category){
    const phrases={
        "Ir al baño":"Fui al baño","Tabaco":"Fumé tabaco","Vapeo":"Vapeé",
        "Alcohol":"Tomé alcohol","Hidratación":"Tomé agua","Cafeína":"Tomé café",
        "Medicación":"Tomé medicación","Sueño":"Dormí","Higiene":"Higiene personal",
        "Descanso":"Descansé","Actividad física":"Hice actividad física"
    };
    return phrases[category]||category;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function categoryNames(){
    return unique([...categoryStore.names(),...entries.map(e=>canonicalCategory(e.category)).filter(name=>name&&!categoryStore.get(name).deleted)]);
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function matchesCategorySearch(category,query){
    const terms=normalizeCategorySearch(query).split(/\s+/).filter(Boolean);
    if(!terms.length)return true;
    const haystack=normalizeCategorySearch([
        category,quickDescription(category),...categoryStore.get(category).keywords
    ].join(" "));
    return terms.every(term=>haystack.includes(term));
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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
    if(!today.length){recent.append(el("p","muted","Aún no has registrado nada hoy."));return;}
    for(const entry of today.slice(0,5)){
        const button=el("button","history-item");
        button.append(iconFor(entry.category));
        const body=el("span","item-main");
        body.append(el("strong","",entry.description),el("small","",formatTime(entry.occurredAt)+(entry.duration!=null?" · "+durationLabel(entry.duration):"")));
        button.append(body);button.onclick=()=>openEdit(entry);recent.append(button);
    }
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function showCaptureFeedback(message,entry=null){
    $("quick-feedback").classList.toggle("has-message",Boolean(message));
    $("capture-status").textContent=message;
    lastQuickEntryId=entry?.id||null;
    $("undo-quick").classList.toggle("hidden",!entry);
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function durationLabel(total){
    const n=Number(total);
    if(!Number.isFinite(n))return "";
    const h=Math.floor(n/60),m=n%60;
    return h?(h+" h"+(m?" "+m+" min":"")):(m+" min");
}

/** Read one combined local date-time field, preserving local calendar times. */
function selectedDateTime(prefix,point){
    const source=$(prefix+"-"+point+"-at").value;
    const label=point==="start"?"inicio":"fin";
    if(!source)throw Error("Completá la fecha y hora de "+label+".");
    const value=new Date(source);
    if(!Number.isFinite(value.getTime())||localTime(value)!==source.slice(0,16))
        throw Error("Revisá la fecha y hora de "+label+".");
    return value;
}

/** Read an optional manually entered duration in minutes. */
function readDurationParts(prefix){
    const rawHours=$(prefix+"-hours").value.trim();
    const rawMinutes=$(prefix+"-minutes").value.trim();
    if(rawHours==="" && rawMinutes==="")return null;
    const hours=rawHours===""?0:Number(rawHours);
    const minutes=rawMinutes===""?0:Number(rawMinutes);
    if(!Number.isSafeInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59)
        throw Error("Usá horas positivas y minutos entre 0 y 59.");
    return hours*60+minutes;
}

/** Display minutes in the two editable duration fields. */
function populateDurationParts(prefix,total){
    $(prefix+"-hours").value=total==null?"":String(Math.floor(total/60));
    $(prefix+"-minutes").value=total==null?"":String(total%60);
}

/** End and duration are alternatives: changing one updates the other. */
const timeInputMode={entry:"none",edit:"none"};
function updateTimeEditor(prefix,source){
    const endField=$(prefix+"-end-at");
    if(source==="duration"){
        // A manually entered duration keeps the end optional and unspecified.
        if(endField.value)endField.value="";
        timeInputMode[prefix]=readDurationParts(prefix)===null?"none":"duration";
        return;
    }
    if(source==="end")timeInputMode[prefix]=endField.value?"end":"none";
    if(timeInputMode[prefix]!=="end")return;
    if(!endField.value){
        populateDurationParts(prefix,null);
        return;
    }
    try{
        const minutes=Math.round((selectedDateTime(prefix,"end")-selectedDateTime(prefix,"start"))/60000);
        populateDurationParts(prefix,minutes>0?minutes:null);
    }catch(_){
        populateDurationParts(prefix,null);
    }
}

/** Set both editing paths from the stored start, optional end and duration. */
function populateTimeEditor(prefix,start,end=null,duration=null){
    $(prefix+"-start-at").value=localTime(start);
    $(prefix+"-end-at").value=end?localTime(end):"";
    timeInputMode[prefix]=end?"end":duration!=null?"duration":"none";
    populateDurationParts(prefix,end?null:duration);
    if(end)updateTimeEditor(prefix,"end");
}

/** Keep occurredAt aligned with the start, and preserve the chosen time mode. */
function timeDetails(prefix){
    const start=selectedDateTime(prefix,"start");
    const startedAt=start.toISOString();
    const endInput=$(prefix+"-end-at").value;
    if(endInput){
        const end=selectedDateTime(prefix,"end");
        if(end.getTime()<=start.getTime())
            throw Error("El fin debe ser posterior al inicio.");
        const duration=Math.round((end.getTime()-start.getTime())/60000);
        return {occurredAt:startedAt,startedAt,endedAt:end.toISOString(),duration};
    }
    return {occurredAt:startedAt,startedAt,endedAt:null,duration:readDurationParts(prefix)};
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function createEntry(details){
    return {
        description:details.description,occurredAt:details.occurredAt,
        category:details.category||null,categorySource:details.categorySource||null,
        energy:details.energy??null,mood:details.mood??null,
        duration:details.duration??null,startedAt:details.startedAt||null,endedAt:details.endedAt||null,notes:details.notes||""
    };
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function resetEntryOptions(){
    $("capture-text").value="";
    $("entry-status").textContent="";
    populateTimeEditor("entry",new Date());
    const cats=categoryNames();
    $("entry-category").replaceChildren(new Option("Automática",""),...cats.map(c=>new Option(c,c)));
    $("entry-category").value="";
    $("entry-energy").value=5;
    $("entry-energy-enabled").checked=false;
    renderEnergy("entry");
    setMood("entry",null);
    $("entry-notes").value="";
    $("entry-options").open=false;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function openEntryDialog(category=null){
    resetEntryOptions();
    const chosen=canonicalCategory(category);
    $("entry-dialog-title").textContent=chosen?"Registrar · "+chosen:"Nueva entrada";
    $("entry-category").value=chosen||"";
    const preview=$("entry-category-preview");
    preview.classList.toggle("hidden",!chosen);
    preview.textContent=chosen?"Categoría: "+chosen:"";
    if(chosen)$("capture-text").value=quickDescription(chosen);
    $("entry-dialog").showModal();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function closeEntryDialog(){
    stopVoice();
    $("entry-dialog").close();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function reload(){entries=await storage.list();drawHistory();drawCategories();drawSummary();drawDashboard();}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function openEdit(e){
    current=e;mood=e.mood??null;
    $("edit-text").value=e.description;
    populateTimeEditor("edit",e.startedAt||e.occurredAt,e.endedAt,e.duration);
    categoryOptions();$("edit-category").value=canonicalCategory(e.category);
    $("edit-notes").value=e.notes||"";
    $("edit-energy-enabled").checked=e.energy!=null;$("edit-energy").value=e.energy??5;
    renderEnergy("edit");setMood("edit",mood);
    $("edit-voice-status").textContent="";
    $("edit-dialog").showModal();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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
    if(!root.children.length)root.append(el("p","muted","No hay categorías. Agrega una con +."));
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function deleteCategory(name,count){
    if(!await appConfirm("¿Eliminar «"+name+"» de las categorías?"+(count?" Sus "+count+" registros anteriores se conservarán en el historial.":""),"Eliminar categoría","Eliminar"))return;
    categoryStore.remove(name);
    await reload();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function saveCategoryEditor(){
    const save=$("cat-save");save.disabled=true;$("cat-error").textContent="";
    try{
        const original=editingCategory;
        const name=$("cat-name").value.trim().replace(/\s+/g," ");
        if(!name||name.length>64)throw Error("Ingresa un nombre de hasta 64 caracteres.");
        const words=$("cat-keywords").value.split(/[,\n;]/).map(x=>x.trim()).filter(Boolean);
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function readCategoryImage(file){
    return new Promise((resolve,reject)=>{
        if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type))return reject(Error("Elige una imagen PNG, JPG o WebP."));
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function summaryBuckets(records, selectedPeriod, now=new Date()){
    const count=selectedPeriod==="week"?7:selectedPeriod==="month"?30:12;
    const totals=Array(count).fill(0),inPeriod=[];
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    for(const entry of records){
        const date=new Date(entry.occurredAt);
        if(!Number.isFinite(date.getTime()))continue;
        const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
        const dateDay=Date.UTC(day.getFullYear(),day.getMonth(),day.getDate());
        const todayDay=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
        const days=Math.round((todayDay-dateDay)/86400000);
        const age=selectedPeriod==="year"?
            (today.getFullYear()-day.getFullYear())*12+today.getMonth()-day.getMonth():days;
        if(age<0||age>=count)continue;
        totals[count-1-age]++;
        inPeriod.push(entry);
    }
    return {totals,inPeriod};
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function drawSummary(){
    const now=new Date();
    const label=period==="week"?"Últimos 7 días":period==="month"?"Últimos 30 días":"Últimos 12 meses";
    $("period-label").textContent=label;
    const {totals,inPeriod}=summaryBuckets(entries,period,now);
    const max=Math.max(1,...totals),chart=$("chart");
    chart.replaceChildren();
    chart.classList.toggle("empty",inPeriod.length===0);
    for(let i=0;i<totals.length;i++){
        const cell=el("div","bar-cell"),bar=el("div","bar");
        const age=totals.length-1-i,day=new Date(now.getFullYear(),now.getMonth(),now.getDate());
        if(period==="year")day.setMonth(day.getMonth()-age);
        else day.setDate(day.getDate()-age);
        const label=period==="week"?["D","L","M","X","J","V","S"][day.getDay()]:
            period==="month"?(i%5===0||i===totals.length-1?String(day.getDate()):""):
            ["E","F","M","A","M","J","J","A","S","O","N","D"][day.getMonth()];
        bar.style.height=totals[i]===0?"0px":Math.max(10,totals[i]/max*130)+"px";
        bar.title=day.toLocaleDateString()+" · "+totals[i]+" registros";
        cell.append(bar,el("span","",label));chart.append(cell);
    }
    if(!inPeriod.length)chart.append(el("div","chart-empty-message","No hay registros en este período."));
    const countsCat=new Map();
    inPeriod.forEach(entry=>{
        const category=canonicalCategory(entry.category)||"Sin categoría";
        countsCat.set(category,(countsCat.get(category)||0)+1);
    });
    const root=$("summary-categories");root.replaceChildren();
    for(const [cat,count] of [...countsCat].sort((a,b)=>b[1]-a[1])){
        const row=el("div","category-item");
        row.append(iconFor(cat),el("span","item-main",cat),el("span","muted",String(count)));
        root.append(row);
    }
    $("summary-count").textContent=inPeriod.length+" registros en el período";
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function saveCapture(){
    const description=$("capture-text").value.trim();
    if(!description){$("capture-text").focus();return;}
    if(quickSaving)return;
    let timing;
    try{timing=timeDetails("entry");}
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
            mood:readMood("entry"),
            notes:$("entry-notes").value.trim()
        }));
        closeEntryDialog();await reload();
        showCaptureFeedback("Entrada guardada · "+formatTime(record.occurredAt),record);
    }catch(error){$("entry-status").textContent="No se pudo guardar: "+error.message;}
    finally{quickSaving=false;$("capture-save").disabled=false;}
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function csv(selectedEntries=entries){const cols=["id","occurredAt","startedAt","endedAt","createdAt","updatedAt","description","category","categorySource","energy","mood","duration","notes"];const esc=x=>'"'+String(x??"").replaceAll('"','""')+'"';return "\uFEFF"+[cols.join(","),...selectedEntries.map(e=>cols.map(k=>esc(e[k])).join(","))].join("\r\n")}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function completeBackup(){
    const preferences={
        reducedMotion:$("reduced-motion").checked,
        darkMode:$("dark-mode").checked,
        language:languagePreference()
    };
    return {version:1,kind:"registro-habitos-backup",exportedAt:new Date().toISOString(),
        entries,reminders:reminderStore.list(),
        categories:customCategories(),categoryProfiles:categoryStore.export(),preferences};
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function filteredAnalysisEntries(){
    if(!$("analysis-filter-enabled").checked)return entries;
    const from=$("analysis-from").value,to=$("analysis-to").value;
    if(from&&to&&from>to)throw Error("La fecha Desde no puede ser posterior a Hasta.");
    const start=from?Date.parse(from+"T00:00:00"):null;
    const end=to?Date.parse(to+"T00:00:00"):null;
    return entries.filter(entry=>{
        const stamp=Date.parse(entry.occurredAt||entry.createdAt||"");
        if(!Number.isFinite(stamp))return !from&&!to;
        if(start!==null&&stamp<start)return false;
        if(end!==null&&stamp>=new Date(end).setDate(new Date(end).getDate()+1))return false;
        return true;
    });
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function updateAnalysisDateFilter(){
    const enabled=$("analysis-filter-enabled").checked;
    $("analysis-date-fields").hidden=!enabled;
    $("analysis-filter-enabled").setAttribute("aria-expanded",String(enabled));
}
$("analysis-filter-enabled").onchange=updateAnalysisDateFilter;
updateAnalysisDateFilter();

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function analysisExport(selectedEntries=filteredAnalysisEntries()){
    return {version:1,kind:"registro-habitos-analysis",exportedAt:new Date().toISOString(),entries:selectedEntries};
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function exportAnalysis(type){
    try{
        const selectedEntries=filteredAnalysisEntries();
        if(!selectedEntries.length){$("analysis-status").textContent="No hay registros en ese período.";return;}
        if(type==="json")saveDocument("registro-habitos-datos.json",JSON.stringify(analysisExport(selectedEntries),null,2),"application/json");
        else saveDocument("registro-habitos-datos.csv",csv(selectedEntries),"text/csv");
    }catch(error){$("analysis-status").textContent=error.message;}
}
let documentStatusTarget="document-status";
window.registroDocumentResult=(ok,message)=>{
    $(documentStatusTarget).textContent=message;
};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function saveDocument(name,content,type){
    documentStatusTarget=name==="registro-habitos-respaldo.zip"?"document-status":"analysis-status";
    const docs=window.AppDocuments;
    if(docs?.save){
        $(documentStatusTarget).textContent="Elige dónde guardar el archivo.";
        docs.save(name,content,type);
        return;
    }
    const url=URL.createObjectURL(new Blob([content],{type}));
    const link=el("a");link.href=url;link.download=name;document.body.append(link);
    link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    $(documentStatusTarget).textContent="Descarga solicitada.";
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function addReminderTimeRow(value=""){
    const list=$("reminder-times"),row=el("div","reminder-time-row");
    const input=el("input","reminder-time-input");
    input.type="time";input.required=true;input.value=value;
    input.setAttribute("aria-label","Horario "+(list.children.length+1));
    const remove=el("button","reminder-time-remove","×");
    remove.type="button";remove.setAttribute("aria-label","Eliminar horario");
    remove.onclick=()=>{
        if(list.children.length<=1)return;
        row.remove();updateReminderTimeRows();
    };
    row.append(input,remove);list.append(row);updateReminderTimeRows();
    return input;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function updateReminderTimeRows(){
    const rows=[...$("reminder-times").children];
    for(let i=0;i<rows.length;i++){
        rows[i].querySelector("input").setAttribute("aria-label","Horario "+(i+1));
        rows[i].querySelector("button").disabled=rows.length===1;
    }
    $("reminder-add-time").disabled=rows.length>=REMINDER_MAX_TIMES;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function reminderFormTimes(){
    const values=[...$("reminder-times").querySelectorAll('input[type="time"]')].map(input=>input.value);
    return reminderStore.normalizeTimes(values);
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function openReminderDialog(item=null){
    editingReminderId=item?.id||null;
    $("reminder-dialog-title").textContent=item?"Editar recordatorio":"Nuevo recordatorio";
    $("reminder-name").value=item?.title||"";
    const times=item?(item.times?.length?item.times:[item.time]):["13:00"];
    $("reminder-times").replaceChildren();
    for(const time of times)addReminderTimeRow(time);
    $("reminder-repeat").value=item?.repeat||(item?.daily?"daily":"once");
    $("reminder-sound").value=item?.sound||"glock";
    $("reminder-dialog-status").textContent="";
    $("reminder-confirm").textContent="Guardar";
    $("reminder-delete").classList.toggle("hidden",!item);
    $("reminder-dialog").showModal();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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
        body.append(el("strong","",item.title),el("small","",
            (item.times?.length?item.times:[item.time]).join(" · ")+" · "+(item.repeat==="weekdays"?"Lun a vie":item.daily?"Todos los días":"Una vez")));
        open.append(body);row.append(open);
        const switchLabel=el("label","reminder-switch");
        const toggle=el("input");
        toggle.type="checkbox";toggle.setAttribute("role","switch");
        toggle.checked=item.enabled!==false;
        toggle.setAttribute("aria-label",(toggle.checked?"Desactivar":"Activar")+" recordatorio: "+item.title);
        const track=el("span","sensory-switch-track");
        track.setAttribute("aria-hidden","true");
        switchLabel.append(toggle,track);
        toggle.onchange=async()=>{
            const enabled=toggle.checked;
            toggle.disabled=true;
            try{
    await reminderStore.setEnabled(item.id,enabled);
    drawReminders();
    $("reminder-status").textContent=reminderStore.status();
            }catch(error){
    toggle.checked=!enabled;
    $("reminder-status").textContent=error.message;
            }finally{toggle.disabled=false;}
        };
        row.append(switchLabel);root.append(row);
    }
    if(!items.length)root.append(el("p","muted","Todavía no hay recordatorios."));
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function importBackup(file){
    if(!/\\.zip$/i.test(file.name||""))throw Error("Selecciona un respaldo ZIP.");
    const signature=new Uint8Array(await file.slice(0,4).arrayBuffer());
    if(signature.length!==4||signature[0]!==0x50||signature[1]!==0x4b||
    signature[2]!==0x03||signature[3]!==0x04)
        throw Error("El archivo no es un respaldo ZIP válido.");
    const backup=JSON.parse(await backupFileText(file));if(backup.version!==1||!Array.isArray(backup.entries))throw Error("Formato JSON incompatible");
    const ids=new Set();for(const e of backup.entries){if(!e||typeof e.id!=="string"||ids.has(e.id)||typeof e.description!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||!Number.isFinite(Date.parse(e.createdAt)))throw Error("Entrada inválida en el archivo");ids.add(e.id);}
    if(!await appConfirm("Importar "+backup.entries.length+" entradas sin sobrescribir los registros existentes.","Importar datos","Importar"))return;
    const n=await storage.importEntries(backup.entries);
    if(backup.preferences && typeof backup.preferences.language==="string")setLanguagePreference(backup.preferences.language);
    if(backup.preferences && typeof backup.preferences.darkMode==="boolean")applyDarkMode(backup.preferences.darkMode);
    if(backup.preferences && typeof backup.preferences.reducedMotion==="boolean"){
        $("reduced-motion").checked=backup.preferences.reducedMotion;
        document.documentElement.classList.toggle("reduce-motion",backup.preferences.reducedMotion);
        try{localStorage.setItem("registro-habitos-reduced-motion",String(backup.preferences.reducedMotion));}catch(error){console.warn(error);}
    }
    if(backup.categoryProfiles)categoryStore.merge(backup.categoryProfiles);
    if(Array.isArray(backup.categories))for(const cat of backup.categories){if(typeof cat==="string"&&cat.trim())saveCategory(cat.trim());}
    await reload();
    let notice="Importadas "+n.imported+" entradas. "+n.skipped+" ya existían.";
    if(Array.isArray(backup.reminders)&&backup.reminders.length){

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
        const identity=r=>r.title+"|"+(r.times?.length?r.times:[r.time]).join(",")+"|"+r.repeat;
        const existing=new Set(reminderStore.list().map(identity));
        const add=backup.reminders.filter(r=>{
            if(!r||typeof r.title!=="string")return false;
            try{return !!reminderStore.normalizeTimes(r.times?.length?r.times:r.time)&&!existing.has(identity(r));}
            catch{return false;}
        });
        if(add.length&&await appConfirm("El respaldo incluye "+add.length+" recordatorios nuevos. ¿Quieres programarlos en este dispositivo?","Restaurar recordatorios","Programar")){
            let done=0;
            for(const r of add){
    try{const item=await reminderStore.add(r.title,r.times?.length?r.times:r.time,r.repeat!=="once",r.repeat||"daily",r.sound||"none");if(r.enabled===false)await reminderStore.setEnabled(item.id,false);done++;}
    catch(err){notice+=" Algunos recordatorios no pudieron programarse: "+err.message;break;}
            }
            notice+=" Recordatorios restaurados: "+done+".";
        }
    }
    await appInfo(notice,"Importación completada");
}
let voicePending = false;
let voiceSession = null;
let voiceRequestId = 0;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function voiceFeedback(targetId, message) {
    const status = $(targetId === "edit-text" ? "edit-voice-status" : "entry-status");
    if (status) status.textContent = message;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function voiceButtons(active) {
    for (const id of ["mic", "edit-dictate"]) {
        const button = $(id);
        const icon = button.querySelector("use");
        button.classList.toggle("listening", active);
        icon.setAttribute("href", active ? "#i-stop" : "#i-mic");
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.setAttribute("aria-label", active ? "Detener dictado" : "Iniciar dictado");
    }
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function stopVoice() {
    voiceRequestId++;
    voicePending = false;
    const session = voiceSession;
    if (!session) { voiceButtons(false); return; }
    session.active = false;
    voiceSession = null;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    if (recognition) {
        const current = recognition;
        recognition = null;
        try { current.stop(); } catch (_) { }
    }
    voiceButtons(false);
    voiceFeedback(session.targetId, "Dictado detenido.");
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function startVoice(targetId = "capture-text") {
    if (voiceSession) { stopVoice(); return; }
    if (voicePending) return;
    const field = $(targetId);
    const native = window.NativeBridge?.Android?.voice;
    if (native?.recognize) {
        voicePending = true;
        const requestId = ++voiceRequestId;
        try {
            field.value="";
            field.dispatchEvent(new Event("input",{bubbles:true}));
            voiceFeedback(targetId, "Abriendo el dictado de Android…");
            const text = await native.recognize({language:currentAppLanguage()==="es"?"es-AR":"en-US"});
            if(requestId!==voiceRequestId || !field.closest("dialog")?.open)return;
            if(text){
    field.value=String(text).trim();
    field.dispatchEvent(new Event("input",{bubbles:true}));
    voiceFeedback(targetId,"Texto dictado.");
            }else voiceFeedback(targetId,"Dictado cancelado.");
        }catch(error){
            if(requestId===voiceRequestId)voiceFeedback(targetId,"No se pudo dictar: "+(error.message||error));
        }finally{
            if(requestId===voiceRequestId)voicePending=false;
        }
        return;
    }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Rec !== "function") {
        voiceFeedback(targetId, "Este dispositivo no ofrece reconocimiento de voz.");
        field.focus();
        return;
    }
    voicePending = true;
    const requestId = ++voiceRequestId;
    try {
        const permissions = window.NativeBridge?.Android?.permissions;
        if (permissions && !permissions.has("microphone")) {
            voiceFeedback(targetId, "Solicitando permiso de micrófono…");
            if (!await permissions.request("microphone")) {
    voiceFeedback(targetId, "El permiso de micrófono no está habilitado.");
    return;
            }
        }
        if(requestId!==voiceRequestId || !field.closest("dialog")?.open ||
            document.visibilityState==="hidden")return;
        field.value="";
        field.dispatchEvent(new Event("input",{bubbles:true}));
        const session = {targetId,field,active:true,committed:"",restartTimer:null};
        voiceSession = session;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
        const run = () => {
            if (!session.active || voiceSession !== session) return;
            const r = new Rec();
            recognition = r;
            r.lang = currentAppLanguage()==="es" ? "es-ES" : "en-US";
            r.interimResults = true;
            r.continuous = true;
            r.maxAlternatives = 1;
            let finalized = "";
            let interim = "";

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
            const updateField = () => {
    field.value = [session.committed,finalized,interim].filter(Boolean).join(" ").trim();
    field.dispatchEvent(new Event("input", {bubbles:true}));
            };
            r.onstart = () => {
    if (session.active) {
        voiceButtons(true);
        voiceFeedback(targetId, "Escuchando… Toca otra vez para detener.");
    }
            };
            r.onresult = event => {
    if (!session.active || recognition !== r) return;
    finalized = ""; interim = "";
    for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        if (result.isFinal) finalized += result[0].transcript.trim() + " ";
        else interim += result[0].transcript.trim() + " ";
    }
    finalized = finalized.trim();
    interim = interim.trim();
    updateField();
            };
            r.onerror = event => {
    if (!session.active) return;
    const messages = {
        "not-allowed": "El navegador rechazó el micrófono.",
        "service-not-allowed": "El servicio de voz está bloqueado.",
        "audio-capture": "No se pudo acceder al micrófono.",
        "network": "El motor de voz necesita conexión.",
        "language-not-supported": "El motor de voz no admite español (Argentina)."
    };
    if (event.error === "no-speech" || event.error === "aborted") return;
    session.active = false;
    voiceSession = null;
    recognition = null;
    voiceButtons(false);
    voiceFeedback(targetId, messages[event.error] || "Error de dictado: " + event.error);
            };
            r.onend = () => {
    if (recognition === r) recognition = null;
    if (!session.active || voiceSession !== session) return;
    session.committed = [session.committed,finalized].filter(Boolean).join(" ").trim();
    field.value = session.committed;
    field.dispatchEvent(new Event("input", {bubbles:true}));
    voiceFeedback(targetId, "Escuchando… puedes hacer pausas. Toca para detener.");
    session.restartTimer = setTimeout(run, 350);
            };
            try { r.start(); }
            catch (error) {
    if (recognition === r) recognition = null;
    session.active = false;
    voiceSession = null;
    voiceButtons(false);
    voiceFeedback(targetId, "No se pudo reiniciar el dictado: " + (error.message || error));
            }
        };
        voiceButtons(true);
        run();
    } catch (error) {
        voiceFeedback(targetId, "No se pudo iniciar el micrófono: " + (error.message || error));
        field.focus();
    } finally {
        if(requestId===voiceRequestId)voicePending = false;
    }
}
let exitConfirmationOpen=false;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function handleDeviceBack(){
    const action=$("app-action-dialog");
    if(action.open){
        action.dispatchEvent(new Event("cancel",{cancelable:true}));
        return true;
    }
    const openDialogs=[...document.querySelectorAll("dialog[open]")];
    if(openDialogs.length){
        stopVoice();
        const dialog=openDialogs[openDialogs.length-1];
        if(dialog.id==="entry-dialog")closeEntryDialog();
        else dialog.close();
        return true;
    }
    const page=document.querySelector(".screen.active")?.id;
    if(["categories","summary","backup","analysis","about"].includes(page)){
        show("more");
        return true;
    }
    if(page!=="capture"){
        show("capture");
        return true;
    }
    if(!exitConfirmationOpen){
        exitConfirmationOpen=true;
        showAppDialog({title:"Salir de la app",message:"¿Quieres salir de Registro Hábitos?",ok:"Salir"}).then(leave=>{
            exitConfirmationOpen=false;
            if(leave)window.AppNavigation?.exitApp();
        });
    }
    return true;
}
window.registroHabitosBack=handleDeviceBack;
document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")stopVoice();
});
window.addEventListener("pagehide",stopVoice);
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>show(b.dataset.page));
$("back").onclick=handleDeviceBack;
$("top-action").onclick=()=>{
    const page=document.querySelector(".screen.active").id;
    if(page==="categories")openCategoryEditor();
    else if(page==="reminders")openReminderDialog();
    else if(page==="capture")show("help");
    else if(page==="history")show("more");
};
$("category-search").addEventListener("input",drawDashboard);
$("add-entry").onclick=()=>openEntryDialog();
$("edit-close").onclick=()=>$("edit-dialog").close();
$("edit-cancel").onclick=()=>$("edit-dialog").close();
$("edit-dialog").addEventListener("close",stopVoice);
$("edit-dialog").addEventListener("cancel",stopVoice);
$("entry-close").onclick=closeEntryDialog;
$("entry-cancel").onclick=closeEntryDialog;
$("entry-dialog").addEventListener("close",stopVoice);
$("entry-dialog").addEventListener("cancel",stopVoice);
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function renderEnergy(prefix){
    const active=$(prefix+"-energy-enabled").checked;
    $(prefix+"-energy-value").textContent=active?$(prefix+"-energy").value+"/10":"-/10";
    $(prefix+"-energy").disabled=!active;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function setMood(prefix,value){
    const selected=value==null?null:Number(value);
    $(prefix+"-mood-value").textContent=selected==null?"-":String(selected)+"/10";
    for(const button of document.querySelectorAll("#"+prefix+"-moods button")){
        const on=Number(button.dataset.mood)===selected;
        button.classList.toggle("selected",on);
        button.setAttribute("aria-pressed",String(on));
    }
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function readMood(prefix){
    const selected=document.querySelector("#"+prefix+"-moods button.selected");
    return selected?Number(selected.dataset.mood):null;
}
for(const prefix of ["entry","edit"]){
    $(prefix+"-energy").oninput=()=>renderEnergy(prefix);
    $(prefix+"-energy-enabled").onchange=()=>renderEnergy(prefix);
    for(const button of document.querySelectorAll("#"+prefix+"-moods button")){
        button.onclick=()=>setMood(prefix,button.classList.contains("selected")?null:Number(button.dataset.mood));
    }
}

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
    const start=$(prefix+"-start-at");
    const end=$(prefix+"-end-at");
    for(const event of ["input","change"]){
        start.addEventListener(event,()=>updateTimeEditor(prefix,"start"));
        end.addEventListener(event,()=>updateTimeEditor(prefix,"end"));
    }
    for(const part of ["hours","minutes"]){
        const input=$(prefix+"-"+part);
        input.addEventListener("input",()=>updateTimeEditor(prefix,"duration"));
        input.addEventListener("change",()=>updateTimeEditor(prefix,"duration"));
    }
}

$("edit-save").onclick=async()=>{
    if(!current)return;
    const description=$("edit-text").value.trim();if(!description){$("edit-text").focus();return;}
    try{
        const timing=timeDetails("edit");
        await storage.save({
            ...current,...timing,description,
            category:canonicalCategory($("edit-category").value)||null,
            categorySource:"manual",mood:readMood("edit"),
            energy:$("edit-energy-enabled").checked?Number($("edit-energy").value):null,
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function stopPreview(){
    window.AppSoundPreview?.stop();
    if(previewAudio){previewAudio.pause();previewAudio=null;}
}
$("preview-sound").onclick=()=>{
    const name=$("reminder-sound").value;
    stopPreview();
    if(name==="none")return;
    if(window.AppSoundPreview?.play){
        window.AppSoundPreview.play(name);
        return;
    }
    previewAudio=new Audio(name==="glock"?"./sounds/glock.mp3":"./sounds/alert.mp3");
    previewAudio.volume=1;
    previewAudio.play().catch(error=>$("reminder-dialog-status").textContent=error.message);
};
$("reminder-dialog").addEventListener("close",stopPreview);
$("reminder-add-time").onclick=()=>{
    if($("reminder-times").children.length>=REMINDER_MAX_TIMES)return;
    const input=addReminderTimeRow("");
    input.focus();
};
$("reminder-cancel").onclick=()=>{
    $("reminder-dialog").close();
    editingReminderId=null;
};
$("reminder-confirm").onclick=async e=>{
    e.preventDefault();
    const title=$("reminder-name").value.trim(),repeat=$("reminder-repeat").value,sound=$("reminder-sound").value;
    try{
        const times=reminderFormTimes();
        if(!title){$("reminder-dialog-status").textContent="Escribe un nombre.";return;}
        if(editingReminderId)await reminderStore.update(editingReminderId,{title,times,repeat,daily:repeat!=="once",sound});
        else await reminderStore.add(title,times,repeat!=="once",repeat,sound);
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
$("backup-save").onclick=()=>saveDocument("registro-habitos-respaldo.zip",JSON.stringify(completeBackup()),"application/zip");
$("export-json").onclick=()=>exportAnalysis("json");
$("export-csv").onclick=()=>exportAnalysis("csv");
$("import-json").onclick=()=>$("import-file").click();
$("import-file").onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{await importBackup(file)}
    catch(error){await appInfo("No se pudo importar: "+error.message,"Error de importación")}
    finally{e.target.value=""}
};
const darkModeInput=$("dark-mode");
const darkModeKey="registro-habitos-dark-mode";

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function applyDarkMode(enabled){
    const dark=!!enabled;
    darkModeInput.checked=dark;
    document.documentElement.classList.toggle("theme-light",!dark);
    document.documentElement.style.colorScheme=dark?"dark":"light";
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.content=dark?"#0b1419":"#eff3f3";
    try{localStorage.setItem(darkModeKey,String(dark));}catch(error){console.warn(error);}
}
try{
    const stored=localStorage.getItem(darkModeKey);
    applyDarkMode(stored===null?true:stored==="true");
}catch(error){applyDarkMode(true);}
darkModeInput.onchange=()=>applyDarkMode(darkModeInput.checked);
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
const buildMeta=document.querySelector('meta[name="app-build"]')?.content || "desarrollo";
const versionMeta=document.querySelector('meta[name="app-version"]')?.content || "desarrollo";
const codeMeta=document.querySelector('meta[name="app-version-code"]')?.content || "";
$("about-version").textContent=versionMeta.startsWith("@")?"desarrollo":versionMeta+(codeMeta&&!codeMeta.startsWith("@")?" ("+codeMeta+")":"");
$("about-build").textContent=buildMeta.startsWith("@")?"desarrollo":buildMeta;
reload().catch(e=>toast("No se pudo abrir la base local: "+e.message));
try{reminderStore.refresh()}catch(e){console.warn(e)}
