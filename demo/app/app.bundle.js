// Browser demo bundle from exactly the same application source modules.
/**
 * storage.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const DB_NAME = "registro-habitos";
const TABLE = "entries";
let dbPromise;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async list() {
        const entries = await transact("readonly", store => store.getAll());
        return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },

    /**
     * Read one bounded History page, newest first, using the existing
     * occurredAt index. Search terms are checked as the cursor advances:
     * only matching records count toward the page size.
     *
     * after contains the last returned (occurredAt, id) pair. IndexedDB
     * sorts duplicate index keys by primary key, so both fields are needed
     * to avoid repeating/skipping entries sharing a timestamp.
     * @return Matching entries and pagination state.
     */
    async listPage({ limit = 25, after = null, from = null, to = null, query = "", category = "" } = {}) {
        const size = Math.max(1, Math.min(100, Math.floor(limit) || 25));
        const db = await connect();
        const lower = from || null;
        const upper = after ? after.occurredAt : (to || null);
        const upperOpen = !after && Boolean(to);
        if (lower && upper && (lower > upper || (lower === upper && upperOpen))) {
            return { items: [], next: null, hasMore: false };
        }
        const range = lower && upper
            ? IDBKeyRange.bound(lower, upper, false, upperOpen)
            : lower ? IDBKeyRange.lowerBound(lower)
                : upper ? IDBKeyRange.upperBound(upper, upperOpen) : null;
        const needle = query.trim().toLocaleLowerCase("es-AR");
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(TABLE, "readonly");
            const request = transaction.objectStore(TABLE).index("occurredAt").openCursor(range, "prev");
            const items = [];
            let settled = false;

            /**
             * Rejects the page request once.
             * @param error Request error.
             * @return None.
             */
            const fail = error => { if (!settled) { settled = true; reject(error); } };
            request.onerror = () => fail(request.error || new Error("Could not read history"));
            transaction.onerror = () => fail(transaction.error || new Error("History transaction failed"));
            transaction.onabort = () => fail(transaction.error || new Error("History transaction aborted"));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    if (!settled) { settled = true; resolve({ items, next: null, hasMore: false }); }
                    return;
                }
                const record = cursor.value;
                if (after && cursor.key === after.occurredAt
                    && String(cursor.primaryKey) >= String(after.id)) {
                    cursor.continue();
                    return;
                }
                const matches = (!category || record.category === category)
                    && (!needle || [record.description, record.notes, record.category]
                        .join(" ").toLocaleLowerCase("es-AR").includes(needle));
                if (matches) {
                    if (items.length === size) {
                        const last = items[items.length - 1];
                        settled = true;
                        resolve({ items, next: { occurredAt: last.occurredAt, id: last.id }, hasMore: true });
                        return;
                    }
                    items.push(record);
                }
                cursor.continue();
            };
        });
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async save(entry) {
        const now = new Date().toISOString();
        const record = { ...entry, id: entry.id || (globalThis.crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "entry-" + Date.now() + "-" + Math.random().toString(36).slice(2)), createdAt: entry.createdAt || now, updatedAt: now };
        await transact("readwrite", store => store.put(record));
        return record;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async remove(id) { await transact("readwrite", store => store.delete(id)); },
};

;
/**
 * classifier.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const rulesByLanguage = {
    es: [
        ["Vapeo", /\b(vapear|vapeo|vapeador|vaper|vapeando|vape[eéó]|cigarrillo\s+electr[oó]nico)(?=$|[\s.,;!?])/i],
        ["Ir al baño", /\b(baño|pis|orinar|orin[eéó]|orinado|micci[oó]n|defecar|defequ[eé]|defecaci[oó]n|evacu[eéó]|evacuaci[oó]n|caca|me[eé])(?=$|[\s.,;!?])/i],
        ["Tabaco", /\b(tabaco|cigarrillos?|cigarros?|puchos?|fum[eéó]|fumar|fumando)(?=$|[\s.,;!?])/i],
        ["Alcohol", /\b(alcohol|cervezas?|birras?|vinos?|fernet|whisk(?:e)?y|vodka|ginebra|gin|sidra|champ[aá]n|tragos?|ron)(?=$|[\s.,;!?])/i],
        ["Medicación", /\b(medicaci[oó]n|medicamentos?|medicinas?|pastillas?|remedios?|dosis)(?=$|[\s.,;!?])/i],
        ["Cafeína", /\b(caf[eé]|cafecito|mate|energizante|cafe[ií]na)(?=$|[\s.,;!?])/i],
        ["Sueño", /dorm|acost|despert|siesta|levant/i],
        ["Alimentación", /com[ií]|comida|desayun|almorz|cen[ée]|merend/i],
        ["Hidratación", /agua|hidrat|beb[ií]/i],
        ["Actividad física", /camin(?:ar|ando|é|o|ata|ó|amos)|ejercic|entren|corr[ií]|trot[eé]|biciclet/i],
        ["Salida", /sal[ií]|camin|pase|calle|viaj|compr/i],
        ["Higiene", /duch|bañ[aeé]|lav|dient/i],
        ["Social", /habl|llam|charl|visit|mensaje|amig/i],
        ["Descanso", /descans|pausa|relaj/i],
    ],};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const words = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 2));

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function suggestCategory(text, entries, language = null, profiles = []) {

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    const normal = value => String(value||"").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
    const normalized = " "+normal(text)+" ";
    let keywordMatch = null, longest = 0;
    for (const profile of profiles) {
        if (!profile || profile.deleted || !profile.name || !Array.isArray(profile.keywords)) continue;
        for (const keyword of profile.keywords) {
            const term = normal(keyword);
            if (!term || term.length < 2) continue;
            const matched = normalized.includes(" "+term);
            if (matched && term.length > longest) {
                keywordMatch = profile.name; longest = term.length;
            }
        }
    }
    if (keywordMatch) return {
        category: keywordMatch, source: "keyword", confidence: 0.95, language: language || "es"
    };
    const tokens = words(text);
    if (!tokens.size) return null;
    let winner = null, best = 0;
    for (const entry of entries) {
        if (!entry.category || !entry.description) continue;
        if (language && entry.language && entry.language !== language) continue;
        const other = words(entry.description);
        const overlap = [...tokens].filter(t => other.has(t)).length;
        const score = overlap / Math.max(tokens.size, other.size, 1) + (entry.categorySource === "manual" ? 0.15 : 0);
        if (score > best) { best = score; winner = entry.category; }
    }
    if (best >= 0.8) return { category: winner, source: "precedent", confidence: Math.min(best, 1), language };

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    const rule = (rulesByLanguage[language || "es"] || []).find(([, test]) => test.test(text));
    if (rule) return { category: rule[0], source: "rule", confidence: 0.6, language: language || "es" };
    return best >= 0.35 ? { category: winner, source: "precedent", confidence: Math.min(best, 1), language } : null;
}

;
/**
 * reminders.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const REMINDER_KEY="registro-habitos-reminders";
const REMINDER_MAX_TIMES=29; // Reserved native IDs: base ... base + 28
const REMINDER_TIME_RE=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const reminderStore={

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    list(){try{return JSON.parse(localStorage.getItem(REMINDER_KEY)||"[]")}catch{return []}},

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    persist(items){localStorage.setItem(REMINDER_KEY,JSON.stringify(items))},

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    normalizeTimes(value){
        const source=Array.isArray(value)?value:[value];
        if(!source.length||source.length>REMINDER_MAX_TIMES)
            throw Error("Elegí entre 1 y "+REMINDER_MAX_TIMES+" horarios.");
        const times=source.map(time=>typeof time==="string"?time.trim():"");
        if(times.some(time=>!REMINDER_TIME_RE.test(time)))throw Error("Completá todos los horarios con una hora válida.");
        if(new Set(times).size!==times.length)throw Error("Hay horarios repetidos. Elegí horas diferentes.");
        return times.sort();
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    timesFor(item){
        return this.normalizeTimes(Array.isArray(item.times)&&item.times.length?item.times:item.time);
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    cancel(item){
        const api=this.api();
        if(api)for(let index=0;index<REMINDER_MAX_TIMES;index++)api.cancel(item.base+index);
    },

    /**
     * Returns the native alarm capability.
     * @return The native alarm capability when available.
     */
    api(){return window.NativeBridge?.Android?.alarms},
    lastWarning:"",

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    status(){return this.lastWarning;},

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    channel(sound){
        const names={none:"Silencioso",glock:"Glockenspiel",alert:"Notificación suave"};
        const key=Object.prototype.hasOwnProperty.call(names,sound)?sound:"none";
        const channel="registro-habitos-"+key+"-v3";
        const uri=this.soundUri(key);
        const notifications=window.NativeBridge?.Android?.notifications;
        if(!notifications)throw Error("Notificaciones nativas no disponibles en este APK.");
        const ok=notifications.createChannel({
            id:channel,name:"Registro Hábitos · "+names[key],
            importance:key==="none"?"low":"default",
            sound:uri,showBadge:false
        });
        if(!ok)throw Error("Android no pudo configurar el canal de notificaciones.");
        return channel;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    soundUri(sound){
        const names={glock:"registro_glock",alert:"registro_alert"};
        const name=names[sound];
        return name?"android.resource://com.kaisarcode.registrohabitos/raw/"+name:"none";
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async permission(){
        const a=window.NativeBridge?.Android;
        if(!a?.alarms||!a?.notifications)throw Error("Alarmas y notificaciones nativas no disponibles en este APK.");
        if(!a.notifications.canPost()){
            if(!a.permissions||!await a.permissions.request("notifications")||!a.notifications.canPost()){
    throw Error("Activá las notificaciones de Registro Hábitos en los ajustes de Android.");
            }
        }
        this.lastWarning="";
        if(a.alarms.canScheduleExact && !a.alarms.canScheduleExact()){
            try{
    if(a.permissions?.request)await a.permissions.request("exactAlarm");
            }catch(error){console.warn("Exact alarm permission request unavailable",error);}
            if(!a.alarms.canScheduleExact()){
    this.lastWarning="Android no autorizó alarmas puntuales. El aviso puede retrasarse cuando el teléfono está en reposo.";
            }
        }
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    nextOccurrence(item,time=item.time){
        if(!REMINDER_TIME_RE.test(time))throw Error("La hora del recordatorio no es válida.");
        const storedAt=item.onceAts?.[time]??(time===item.time?item.onceAt:null);
        if(item.repeat==="once"&&Number.isFinite(storedAt))
            return storedAt>Date.now()?storedAt:null;
        const [hour,minute]=time.split(":").map(Number);
        const day=new Date();day.setHours(hour,minute,0,0);
        for(let i=0;i<8;i++){
            if(day.getTime()>Date.now() &&
                (item.repeat!=="weekdays"||(day.getDay()!==0&&day.getDay()!==6)))
    return day.getTime();
            day.setDate(day.getDate()+1);
        }
        return null;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    schedule(item){
        const api=this.api();
        if(!api)throw Error("Alarmas nativas no disponibles.");
        const times=this.timesFor(item);
        this.cancel(item);
        const scheduleTimes=times.map((time,index)=>({time,index,at:this.nextOccurrence(item,time)}))
            .filter(slot=>slot.at!==null);
        if(!scheduleTimes.length)return false;
        const soundName=item.sound||"none",channel=this.channel(soundName);
        const exact=typeof api.canScheduleExact==="function"&&api.canScheduleExact();
        for(const {time,index,at} of scheduleTimes){
            const [hour,minute]=time.split(":").map(Number);
            const recurrence=item.repeat==="once"?null:{
    mode:item.repeat==="weekdays"?"weekdays":"daily",hour,minute
            };
            const id=item.base+index;
            const ok=api.schedule({
    id,at,exact,allowWhileIdle:true,recurrence,
    action:{
        type:"notification",id,channel,title:item.title,
        text:"Recordatorio",importance:soundName==="none"?"low":"default",
        onlyAlertOnce:false,sound:this.soundUri(soundName)
    }
            });
            if(!ok)throw Error("Android no pudo programar el horario "+time+".");
        }
        return true;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async add(title,timesValue,daily,repeat,sound){
        const titleText=String(title||"").trim();
        const times=this.normalizeTimes(timesValue),cadence=repeat||(daily?"daily":"once");
        if(!titleText||!["once","daily","weekdays"].includes(cadence))
            throw Error("Ingresá un nombre y una frecuencia válida.");
        await this.permission();
        const entries=this.list(),used=new Set(entries.map(x=>x.base));
        let base;
        do{base=100000+Math.floor(Math.random()*45000000)*32}while(used.has(base));
        const item={id:String(base),base,title:titleText,time:times[0],times,
            daily:cadence!=="once",repeat:cadence,sound:sound||"glock",enabled:true};
        if(cadence==="once"){
            item.onceAts=Object.fromEntries(times.map(time=>
    [time,this.nextOccurrence({...item,onceAts:{},onceAt:null},time)]));
        }
        this.schedule(item);entries.push(item);this.persist(entries);return item;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async update(id,changes){
        const items=this.list(),index=items.findIndex(item=>item.id===id);
        if(index<0)throw Error("El recordatorio ya no existe.");
        const current=items[index];
        const times=this.normalizeTimes(changes.times??changes.time);
        const repeat=changes.repeat||"daily",title=String(changes.title||"").trim();
        if(!title||!["once","daily","weekdays"].includes(repeat))
            throw Error("El nombre o la frecuencia del recordatorio no son válidos.");
        const updated={...current,title,time:times[0],times,repeat,
            daily:repeat!=="once",sound:changes.sound};
        delete updated.onceAt;
        if(repeat==="once"){
            updated.onceAts={};
            for(const time of times){
    const previous=current.onceAts?.[time]??(
        current.repeat==="once"&&time===current.time?current.onceAt:null);
    updated.onceAts[time]=current.repeat==="once"&&Number.isFinite(previous)
        ?previous:this.nextOccurrence({...updated,onceAts:{},onceAt:null},time);
            }
        }else delete updated.onceAts;
        if(updated.enabled!==false){
            await this.permission();
            try{this.schedule(updated)}
            catch(error){try{this.schedule(current)}catch(rollback){console.warn("Unable to restore reminder alarms",rollback)}throw error}
        }else this.cancel(updated);
        items[index]=updated;
        this.persist(items);
        return updated;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async setEnabled(id,enabled){
        const list=this.list(),item=list.find(x=>x.id===id);if(!item)return;
        if(enabled){
            await this.permission();
            if(item.repeat==="once"){
    const times=this.timesFor(item),hasFuture=times.some(t=>this.nextOccurrence(item,t)!==null);
    if(!hasFuture){
        item.onceAts=Object.fromEntries(times.map(time=>
            [time,this.nextOccurrence({...item,onceAts:{},onceAt:null},time)]));
        delete item.onceAt;
    }
            }
            this.schedule({...item,enabled:true});
        }else this.cancel(item);
        item.enabled=enabled;this.persist(list);
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    remove(id){
        const list=this.list(),item=list.find(x=>x.id===id);
        if(item)this.cancel(item);
        this.persist(list.filter(x=>x.id!==id));
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    refresh(){
        if(!this.api())return;
        const items=this.list();
        let changed=false;
        for(const item of items){
            if(!item.enabled)continue;
            try{
    const times=this.timesFor(item);
    if(!Array.isArray(item.times)){item.times=times;changed=true;}
    if(item.repeat==="once"){
        if(!item.onceAts){
            item.onceAts=Object.fromEntries(times.map(time=>[
                time,time===item.time&&Number.isFinite(item.onceAt)
        ?item.onceAt:this.nextOccurrence({...item,onceAts:{},onceAt:null},time)
            ]));
            delete item.onceAt;
            changed=true;
        }
        if(times.every(time=>this.nextOccurrence(item,time)===null)){
            item.enabled=false;changed=true;this.cancel(item);continue;
        }
    }
    this.schedule(item);
            }catch(error){console.warn("Alarm restoration",error);}
        }
        if(changed)this.persist(items);
    }
};

;
/**
 * backup-zip.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const MAX_BACKUP_ZIP_BYTES=25*1024*1024;
const MAX_BACKUP_JSON_BYTES=20*1024*1024;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function backupFileText(file){
    if(file.size>MAX_BACKUP_ZIP_BYTES)throw Error("El respaldo es demasiado grande.");
    const data=await file.arrayBuffer();
    const bytes=new Uint8Array(data);
    if(bytes.length<4||!(bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4)){
        return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    }
    const dv=new DataView(data);
    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
        if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
    }
    if(eocd<0)throw Error("Archivo ZIP incompleto o inválido.");
    if(dv.getUint16(eocd+4,true)!==0||dv.getUint16(eocd+6,true)!==0)
        throw Error("No se admiten archivos ZIP divididos.");
    const count=dv.getUint16(eocd+10,true);
    const dirSize=dv.getUint32(eocd+12,true),offset=dv.getUint32(eocd+16,true);
    if(!count||count>30||offset+dirSize>eocd)throw Error("Directorio ZIP inválido.");
    let pos=offset,entry=null;
    for(let i=0;i<count;i++){
        if(pos+46>bytes.length||dv.getUint32(pos,true)!==0x02014b50)throw Error("Entrada ZIP inválida.");
        const method=dv.getUint16(pos+10,true),flags=dv.getUint16(pos+8,true);
        const compressed=dv.getUint32(pos+20,true),uncompressed=dv.getUint32(pos+24,true);
        const nameLen=dv.getUint16(pos+28,true),extraLen=dv.getUint16(pos+30,true),commentLen=dv.getUint16(pos+32,true);
        const end=pos+46+nameLen+extraLen+commentLen;
        if(end>bytes.length)throw Error("Nombre ZIP inválido.");
        const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+nameLen));
        if(name==="registro-habitos.json"){
            if(entry)throw Error("El ZIP contiene varios respaldos.");
            entry={method,flags,compressed,uncompressed,localOffset:dv.getUint32(pos+42,true),crc:dv.getUint32(pos+16,true)};
        }
        pos=end;
    }
    if(!entry)throw Error("El ZIP no contiene registro-habitos.json.");
    if(entry.flags&1)throw Error("No se admiten ZIP cifrados.");
    if(entry.uncompressed>MAX_BACKUP_JSON_BYTES||entry.compressed>MAX_BACKUP_ZIP_BYTES)
        throw Error("El respaldo descomprimido supera el tamaño permitido.");
    const local=entry.localOffset;
    if(local+30>bytes.length||dv.getUint32(local,true)!==0x04034b50)throw Error("Cabecera ZIP inválida.");
    const start=local+30+dv.getUint16(local+26,true)+dv.getUint16(local+28,true);
    if(start+entry.compressed>bytes.length)throw Error("Datos ZIP incompletos.");
    const compressed=bytes.subarray(start,start+entry.compressed);
    let output;
    if(entry.method===0)output=compressed;
    else if(entry.method===8){
        if(typeof DecompressionStream!=="function")throw Error("Este WebView no admite restaurar ZIP. Actualizá Android System WebView.");
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const reader=stream.getReader(),parts=[];let length=0;
        try{
            while(true){
    const {value,done}=await reader.read();if(done)break;
    length+=value.length;
    if(length>MAX_BACKUP_JSON_BYTES){await reader.cancel();throw Error("El respaldo descomprimido supera el tamaño permitido.");}
    parts.push(value);
            }
        }finally{reader.releaseLock();}
        output=new Uint8Array(length);let at=0;
        for(const part of parts){output.set(part,at);at+=part.length;}
    }else throw Error("Método de compresión ZIP no compatible.");
    if(output.length!==entry.uncompressed)throw Error("Tamaño ZIP incorrecto.");
    return new TextDecoder("utf-8",{fatal:true}).decode(output);
}

;
/**
 * categories.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const ICON_NAMES=["footprints","utensils","heart-handshake","heart-pulse","moon","cloud","brain","book-open","briefcase-business","user-round","droplets","coffee","armchair","users-round","shower-head","toilet","cigarette","wind","wine","pill","activity","camera","image","leaf"];
const CATEGORY_PROFILES_KEY="rh-category-profiles-v1";
const CATEGORY_OLD_KEY="rh-categories";
const DEFAULT_TEMPLATES={
    "Sueño":{
        text:"Sueño",
        html:'<h3>Sueño</h3><table><tbody><tr><th>Dato</th><th>Registro</th></tr><tr><td>Minutos hasta dormirme</td><td></td></tr><tr><td>Despertares</td><td></td></tr><tr><td>Siesta (min)</td><td></td></tr><tr><td>Pantalla en la última hora</td><td></td></tr><tr><td>Calidad (0-10)</td><td></td></tr></tbody></table>'
    },
    "Chequeo corporal":{
        text:"Chequeo corporal",
        html:'<h3>Chequeo corporal</h3><table><tbody><tr><th>Señal</th><th>Registro</th></tr><tr><td>Hambre</td><td></td></tr><tr><td>Sed</td><td></td></tr><tr><td>Necesidad de baño</td><td></td></tr><tr><td>Cansancio</td><td></td></tr><tr><td>Sobrecarga / tensión</td><td></td></tr><tr><td>Qué hice</td><td></td></tr></tbody></table>'
    },
    "Salida":{
        text:"Salí",
        html:'<h3>Salida</h3><table><tbody><tr><th>Dato</th><th>Registro</th></tr><tr><td>Destino</td><td></td></tr><tr><td>Con quién (si corresponde)</td><td></td></tr><tr><td>Estímulos (0-10)</td><td></td></tr><tr><td>Malestar antes (0-10)</td><td></td></tr><tr><td>Pico durante (0-10)</td><td></td></tr><tr><td>Malestar después (0-10)</td><td></td></tr><tr><td>Estrategia usada</td><td></td></tr></tbody></table>'
    },
    "Social":{
        text:"Contacto social",
        html:'<h3>Contacto social</h3><table><tbody><tr><th>Dato</th><th>Registro</th></tr><tr><td>Persona / grupo</td><td></td></tr><tr><td>Medio</td><td></td></tr><tr><td>Iniciativa propia</td><td></td></tr><tr><td>Energía antes (0-10)</td><td></td></tr><tr><td>Energía después (0-10)</td><td></td></tr><tr><td>Qué disfruté / qué costó</td><td></td></tr></tbody></table>'
    },
    "Estímulos":{
        text:"Estímulo",
        html:'<h3>Estímulo</h3><table><tbody><tr><th>Dato</th><th>Registro</th></tr><tr><td>Estímulo</td><td></td></tr><tr><td>Dónde / cuándo</td><td></td></tr><tr><td>Intensidad (0-10)</td><td></td></tr><tr><td>Señal corporal</td><td></td></tr><tr><td>Estrategia / apoyo</td><td></td></tr><tr><td>Resultado</td><td></td></tr></tbody></table>'
    }
};
const DEFAULT_ICONS={
    "Actividad física":"footprints","Alimentación":"utensils","Chequeo corporal":"activity","Estímulos":"brain",
    "Salud":"heart-pulse","Sueño":"moon","Emociones":"cloud","Cognitivo":"brain",
    "Ocio":"book-open","Trabajo":"briefcase-business","Personal":"user-round",
    "Hidratación":"droplets","Descanso":"armchair","Salida":"footprints",
    "Social":"users-round","Higiene":"shower-head","Ir al baño":"toilet",
    "Tabaco":"cigarette","Vapeo":"wind","Alcohol":"wine","Medicación":"pill","Cafeína":"coffee"
};

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function profileName(name){return String(name||"").trim().replace(/\s+/g," ");}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function profileWords(value){
    const words=Array.isArray(value)?value:String(value||"").split(/[,\n;]/);
    return [...new Set(words.map(x=>String(x).trim()).filter(x=>x.length>0&&x.length<=60))].slice(0,30);
}
const categoryStore={

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    raw(){
        try{
            const data=JSON.parse(localStorage.getItem(CATEGORY_PROFILES_KEY)||"{}");
            return data&&typeof data==="object"&&!Array.isArray(data)?data:{};
        }catch{return {}}
    },

    /**
     * Stores category profile values.
     * @return None.
     */
    write(values){localStorage.setItem(CATEGORY_PROFILES_KEY,JSON.stringify(values))},

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    names(){
        let legacy=[];try{legacy=JSON.parse(localStorage.getItem(CATEGORY_OLD_KEY)||"[]")}catch{}
        const known=[...preset.map(row=>row[0]),...(Array.isArray(legacy)?legacy:[]),...Object.keys(this.raw())];
        const seen=new Set();
        return known.filter(name=>{
            if(typeof name!=="string")return false;
            const key=name.toLocaleLowerCase("es-AR");
            if(seen.has(key))return false;
            seen.add(key);
            return !this.raw()[name]?.deleted;
        });
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    get(name){
        const key=profileName(name);
        const original=preset.find(row=>row[0].toLocaleLowerCase("es-AR")===key.toLocaleLowerCase("es-AR"));
        const saved=this.raw()[key]||{};
        const keywords=Object.prototype.hasOwnProperty.call(saved,"keywords")?saved.keywords:(typeof categoryAliases!=="undefined"?categoryAliases[key]||[]:[]);
        return {
            name:key,
            color:["green","blue","purple","orange","grey"].includes(saved.color)?saved.color:original?.[2]||"grey",
            icon:ICON_NAMES.includes(saved.icon)?saved.icon:DEFAULT_ICONS[key]||"leaf",
            image:typeof saved.image==="string"&&/^data:image\/(webp|png|jpeg);base64,/.test(saved.image)?saved.image:null,
            suggestedDescription:DEFAULT_TEMPLATES[key]?.text||"",defaultHtml:typeof saved.defaultHtml==="string"?saved.defaultHtml:(!saved.defaultDescription?DEFAULT_TEMPLATES[key]?.html||"":"")+"",keywords:profileWords(keywords),defaultDescription:typeof saved.defaultDescription==="string"?saved.defaultDescription:"",deleted:saved.deleted===true,builtin:!!original
        };
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    list(){
        return this.names().map(name=>this.get(name));
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    save(profile,originalName=null){
        const name=profileName(profile.name);
        if(!name||name.length>64)throw Error("El nombre debe tener entre 1 y 64 caracteres.");
        const former=profileName(originalName);
        const duplicate=this.names().some(n=>n.toLocaleLowerCase("es-AR")===name.toLocaleLowerCase("es-AR")&&n!==former);
        if(duplicate)throw Error("Ya existe una categoría con ese nombre.");
        const old=this.raw(),saved={
            color:["green","blue","purple","orange","grey"].includes(profile.color)?profile.color:"grey",
            icon:ICON_NAMES.includes(profile.icon)?profile.icon:"leaf",
            image:typeof profile.image==="string"&&/^data:image\/(webp|png|jpeg);base64,/.test(profile.image)?profile.image:null,
            keywords:profileWords(profile.keywords),defaultDescription:String(profile.defaultDescription||"").trim(),defaultHtml:String(profile.defaultHtml||""),deleted:false
        };
        if(saved.image?.length>240000)throw Error("La imagen es demasiado grande.");
        if(former&&former!==name)old[former]={...this.get(former),deleted:true};
        old[name]=saved;
        this.write(old);
        return {name,oldName:former&&former!==name?former:null};
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    remove(name){
        const key=profileName(name);
        if(!this.names().includes(key))throw Error("No existe la categoría.");
        this.write({...this.raw(),[key]:{...this.get(key),deleted:true}});
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    export(){return this.raw()},

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    merge(profiles){
        if(!profiles||typeof profiles!=="object"||Array.isArray(profiles))return;
        const saved=this.raw();
        for(const [name,profile] of Object.entries(profiles)){
            if(!name||name.length>64||!profile||typeof profile!=="object")continue;
            if(saved[name])continue;
            const image=typeof profile.image==="string"&&profile.image.length<240000?profile.image:null;
            saved[name]={
    color:["green","blue","purple","orange","grey"].includes(profile.color)?profile.color:"grey",
    icon:ICON_NAMES.includes(profile.icon)?profile.icon:"leaf",
    keywords:profileWords(profile.keywords),defaultDescription:typeof profile.defaultDescription==="string"?profile.defaultDescription:"",defaultHtml:typeof profile.defaultHtml==="string"?profile.defaultHtml:"",image,deleted:profile.deleted===true
            };
        }
        this.write(saved);
    }
};

;
/**
 * app.js - Habit register interface.
 * Summary: Coordinates the browser interface for habit entries.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */





/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
const $=id=>document.getElementById(id);
const preset=[["Alimentación","🍴","orange"],["Sueño","☾","purple"],["Chequeo corporal","◉","purple"],["Salida","🚶","green"],["Social","♥","purple"],["Estímulos","◉","blue"],["Ir al baño","🚻","blue"],["Medicación","✚","blue"],["Cafeína","☕","orange"],["Tabaco","♨","orange"],["Vapeo","≈","purple"],["Alcohol","◌","orange"],["Hidratación","💧","blue"],["Actividad física","🚶","green"]];

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
    ["capture","history","categories","summary","reminders","backup","analysis","settings","language","sensory","about"]
        .forEach(id=>$(id).classList.toggle("active",id===page));
    document.querySelectorAll(".tabs button")
        .forEach(button=>button.classList.toggle("active",button.dataset.page===page || (page==="summary"&&button.dataset.page==="capture")));
    const settingsPage=["settings","backup","analysis","language","sensory","about"].includes(page);
    $("settings-button").classList.toggle("active",settingsPage);
    const actions={capture:"Nueva entrada",categories:"Crear categoría",reminders:"Nuevo recordatorio"};
    const action=$("add-entry"),label=actions[page];
    action.classList.toggle("hidden",!label);
    if(label){
        const translated=typeof translateLabel==="function"?translateLabel(label,currentAppLanguage()):label;
        action.setAttribute("aria-label",translated);action.title=translated;
    }
    if(page==="capture"){drawDashboard();drawSummaryPreview();}
    if(page==="history")drawHistory();
    if(page==="categories")drawCategories();
    if(page==="reminders")drawReminders();
    if(page==="summary")drawSummary();
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

const systemReducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)");

/**
 * Reports whether interface animations are enabled.
 * @return Whether animations are enabled.
 */
function animationsEnabled(){
    return !document.documentElement.classList.contains("reduce-motion") && !systemReducedMotion?.matches;
}

/** Animate dismissal before calling native dialog.close(). */
const pendingDialogClosures=new WeakMap();

/**
 * Closes an open dialog after its dismissal animation.
 * @param dialog Dialog to close.
 * @return Completion promise.
 */
function dismissDialog(dialog){
    if(!dialog?.open)return Promise.resolve();
    const active=pendingDialogClosures.get(dialog);
    if(active)return active;
    if(!animationsEnabled()){
        dialog.close();
        return Promise.resolve();
    }
    dialog.classList.add("closing");
    const pending=new Promise(resolve=>{
        let finished=false;
        let fallback;

        /**
         * Completes the pending dialog dismissal.
         * @return None.
         */
        const complete=()=>{
            if(finished)return;
            finished=true;
            clearTimeout(fallback);
            dialog.removeEventListener("animationend",onEnd);
            dialog.classList.remove("closing");
            if(dialog.open)dialog.close();
            resolve();
        };

        /**
         * Completes dismissal when its exit animation ends.
         * @param event Animation event.
         * @return None.
         */
        const onEnd=event=>{
            if(event.target===dialog && event.animationName==="rh-dialog-exit")complete();
        };
        dialog.addEventListener("animationend",onEnd);
        fallback=setTimeout(complete,220);
    });
    pendingDialogClosures.set(dialog,pending);
    pending.finally(()=>{
        if(pendingDialogClosures.get(dialog)===pending)pendingDialogClosures.delete(dialog);
    });
    return pending;
}

/**
 * Opens the application action dialog.
 * @param options Dialog options.
 * @return Promise resolved with the dialog result.
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
        const finish=async result=>{
            if(settled)return;
            settled=true;
            dialog.onclose=null;dialog.oncancel=null;
            $("app-action-ok").onclick=null;
            $("app-action-cancel").onclick=null;
            await dismissDialog(dialog);
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
    return categoryStore.get(category).defaultDescription||phrases[category]||categoryStore.get(category).suggestedDescription||category;
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

let captureFeedbackTimeout=null;
let captureFeedbackFadeTimeout=null;

/**
 * Updates quick-capture feedback state and schedules its clearance.
 * @param message Feedback message text.
 * @param entry Associated entry.
 * @return void.
 */
function showCaptureFeedback(message,entry=null){
    clearTimeout(captureFeedbackTimeout);
    clearTimeout(captureFeedbackFadeTimeout);
    captureFeedbackTimeout=null;
    captureFeedbackFadeTimeout=null;
    const notice=$("quick-feedback");
    notice.classList.remove("fading-out");
    if(!message){
        notice.classList.remove("has-message");
        $("capture-status").textContent="";
        lastQuickEntryId=null;
        $("undo-quick").classList.add("hidden");
        return;
    }
    const wasVisible=notice.classList.contains("has-message");
    $("capture-status").textContent=message;
    lastQuickEntryId=entry?.id||null;
    $("undo-quick").classList.toggle("hidden",!entry);
    notice.classList.add("has-message");
    if(!wasVisible && animationsEnabled()){
        notice.classList.remove("fading-in");
        void notice.offsetWidth;
        notice.classList.add("fading-in");
    }else{
        notice.classList.remove("fading-in");
    }
    captureFeedbackTimeout=setTimeout(()=>{
        captureFeedbackTimeout=null;
        if(!animationsEnabled()){
            showCaptureFeedback("");
            return;
        }
        notice.classList.remove("fading-in");
        notice.classList.add("fading-out");
        captureFeedbackFadeTimeout=setTimeout(()=>{
            captureFeedbackFadeTimeout=null;
            showCaptureFeedback("");
        },180);
    },2000);
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

/**
 * Reads the local date and time selected with the native compact picker.
 * @param prefix Field prefix.
 * @param point Time point.
 * @return Selected date and time.
 */
function selectedDateTime(prefix,point){
    const source=$(prefix+"-"+point+"-at").value;
    const label=point==="start"?"inicio":"fin";
    if(!source)throw Error("Completá la fecha y hora de "+label+".");
    const value=new Date(source);
    if(!Number.isFinite(value.getTime())||localTime(value)!==source.slice(0,16))
        throw Error("Revisá la fecha y hora de "+label+".");
    return value;
}

/**
 * Reads an optional duration entered as hours and minutes.
 * @param prefix Field prefix.
 * @return Duration in minutes, or null.
 */
function readDurationParts(prefix){
    const rawHours=$(prefix+"-hours").value.trim();
    const rawMinutes=$(prefix+"-minutes").value.trim();
    if(rawHours===""&&rawMinutes==="")return null;
    const hours=rawHours===""?0:Number(rawHours);
    const minutes=rawMinutes===""?0:Number(rawMinutes);
    if(!Number.isSafeInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59)
        throw Error("Usá horas positivas y minutos entre 0 y 59.");
    const total=hours*60+minutes;
    if(!Number.isSafeInteger(total))throw Error("La duración es demasiado grande.");
    return total;
}

/**
 * Writes a duration into its hour and minute fields.
 * @param prefix Field prefix.
 * @param total Duration in minutes.
 * @return None.
 */
function populateDurationParts(prefix,total){
    $(prefix+"-hours").value=total==null?"":String(Math.floor(total/60));
    $(prefix+"-minutes").value=total==null?"":String(total%60);
}

/**
 * Shows the chosen or inferred end without adding a second form field.
 * @param prefix Field prefix.
 * @return None.
 */
function refreshTimeEndCaption(prefix){
    const caption=$(prefix+"-end-caption");
    const endField=$(prefix+"-end-at");
    if(!endField.value){
        caption.hidden=true;
        $(prefix+"-end-summary").textContent="";
        return;
    }
    try{
        const end=selectedDateTime(prefix,"end");
        const english=currentAppLanguage()==="en";
        const formatted=end.toLocaleString(english?"en-US":"es-AR",{dateStyle:"short",timeStyle:"short"});
        $(prefix+"-end-summary").textContent=(english?"End: ":"Fin: ")+formatted;
        caption.hidden=false;
    }catch(_){
        caption.hidden=true;
    }
}

/** Maintain the last edited value: duration sets end; end sets duration. */
const timeInputMode={entry:"none",edit:"none"};

/**
 * Synchronizes duration and end-time editor fields.
 * @param prefix Field prefix.
 * @param source Field that changed.
 * @return None.
 */
function updateTimeEditor(prefix,source){
    const endField=$(prefix+"-end-at");
    if(source==="duration"||(source==="start"&&timeInputMode[prefix]==="duration")){
        timeInputMode[prefix]="duration";
        try{
            const minutes=readDurationParts(prefix);
            if(minutes===null){
                timeInputMode[prefix]="none";
                endField.value="";
            }else{
                const start=selectedDateTime(prefix,"start");
                endField.value=localTime(new Date(start.getTime()+minutes*60000));
            }
        }catch(_){
            endField.value="";
        }
    }else if(source==="end"){
        timeInputMode[prefix]=endField.value?"end":"none";
        if(!endField.value){
            populateDurationParts(prefix,null);
        }else{
            try{
                const minutes=Math.round((selectedDateTime(prefix,"end")-selectedDateTime(prefix,"start"))/60000);
                populateDurationParts(prefix,minutes>=0?minutes:null);
            }catch(_){
                populateDurationParts(prefix,null);
            }
        }
    }else if(source==="start"&&timeInputMode[prefix]==="end"){
        updateTimeEditor(prefix,"end");
        return;
    }
    refreshTimeEndCaption(prefix);
}

/**
 * Populates a time editor with stored values.
 * @param prefix Field prefix.
 * @param start Start date and time.
 * @param end Optional end date and time.
 * @param duration Optional duration in minutes.
 * @return None.
 */
function populateTimeEditor(prefix,start,end=null,duration=null){
    $(prefix+"-start-at").value=localTime(start);
    $(prefix+"-end-at").value=end?localTime(end):"";
    timeInputMode[prefix]=end?"end":duration!=null?"duration":"none";
    populateDurationParts(prefix,duration);
    if(end)updateTimeEditor(prefix,"end");
    else if(duration!=null)updateTimeEditor(prefix,"duration");
    else refreshTimeEndCaption(prefix);
}

/**
 * Returns start, optional end, and duration from editor fields.
 * @param prefix Field prefix.
 * @return Stored time details.
 */
function timeDetails(prefix){
    const start=selectedDateTime(prefix,"start");
    const startedAt=start.toISOString();
    const endInput=$(prefix+"-end-at").value;
    if(endInput){
        const end=selectedDateTime(prefix,"end");
        if(end.getTime()<start.getTime())
            throw Error("El fin no puede ser anterior al inicio.");
        const duration=Math.round((end.getTime()-start.getTime())/60000);
        return {occurredAt:startedAt,startedAt,endedAt:end.toISOString(),duration};
    }
    const duration=readDurationParts(prefix);
    if(duration===null)return {occurredAt:startedAt,startedAt,endedAt:null,duration:null};
    const derivedEnd=new Date(start.getTime()+duration*60000);
    if(!Number.isFinite(derivedEnd.getTime()))throw Error("La duración es demasiado grande.");
    return {occurredAt:startedAt,startedAt,endedAt:derivedEnd.toISOString(),duration};
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
    setRichText("capture-text");
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
const RICH_TAGS=new Set(["P","DIV","BR","B","STRONG","EM","I","U","H2","H3","UL","OL","LI","A","TABLE","THEAD","TBODY","TR","TD","TH","BLOCKQUOTE"]);
/**
 * Restricts HTML to harmless formatting before displaying or persisting it.
 * @param html Arbitrary HTML string.
 * @return Sanitized HTML.
 */
function safeRichHTML(html){
    const input=new DOMParser().parseFromString(String(html||""),"text/html");
    const result=document.createElement("div");
    function copy(source,target){
        for(const node of source.childNodes){
            if(node.nodeType===3){target.append(document.createTextNode(node.nodeValue));continue;}
            if(node.nodeType!==1)continue;
            if(!RICH_TAGS.has(node.tagName)){copy(node,target);continue;}
            const next=document.createElement(node.tagName.toLowerCase());
            if(node.tagName==="A"){
                const url=node.getAttribute("href")||"";
                if(/^https?:\/\//i.test(url)){
                    next.setAttribute("href",url);
                    next.setAttribute("target","_blank");
                    next.setAttribute("rel","noopener noreferrer");
                }
            }
            copy(node,next);
            target.append(next);
        }
    }
    copy(input.body,result);
    return result.innerHTML;
}
/**
 * Returns the plain-text representation for searching and CSV exports.
 * @param id Editor ID.
 * @return Plain-text content.
 */
function richText(id){return $(id).innerText.trim();}
/**
 * Loads an editor without modifying stored plain-text records.
 * @param id Editor ID.
 * @param text Existing plain text.
 * @param html Existing formatted text.
 * @return void.
 */
function setRichText(id,text="",html=""){
    const field=$(id);
    if(html)field.innerHTML=safeRichHTML(html);
    else field.textContent=text||"";
}
/**
 * Inserts speech transcription as a new paragraph without deleting a template.
 * @param field Editor.
 * @param value Dictated text.
 * @return void.
 */
function appendDictation(field,value){
    const content=String(value||"").trim();
    if(!content)return;
    const paragraph=document.createElement("p");
    paragraph.textContent=content;
    field.append(paragraph);
    field.dispatchEvent(new Event("input",{bubbles:true}));
}
/**
 * Initializes formatting actions for a self-contained contenteditable editor.
 * @param container Editor container.
 * @return void.
 */
function setupRichEditor(container){
    const field=container.querySelector(".rich-content");
    const toolbar=container.querySelector(".rich-toolbar");
    toolbar.addEventListener("pointerdown",event=>{
        if(event.target.closest("button"))event.preventDefault();
    });
    toolbar.addEventListener("click",async event=>{
        const button=event.target.closest("button[data-rich]");
        if(!button)return;
        const kind=button.dataset.rich;
        if(kind==="empty"){field.replaceChildren();field.focus();return;}
        if(kind==="table"){
            const table=document.createElement("table");
            const tbody=document.createElement("tbody");
            for(let row=0;row<3;row++){
                const tr=document.createElement("tr");
                for(let col=0;col<2;col++){
                    const cell=document.createElement(row===0?"th":"td");
                    cell.textContent=row===0?(col===0?"Campo":"Dato"):"";
                    tr.append(cell);
                }
                tbody.append(tr);
            }
            table.append(tbody);
            const selection=window.getSelection();
            if(selection?.rangeCount&&field.contains(selection.anchorNode)){
                const range=selection.getRangeAt(0);
                range.deleteContents();range.insertNode(table);
            }else field.append(table);
            field.focus();return;
        }
        if(kind==="link"){
            const selection=window.getSelection();
            const savedRange=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;
            const url=await appPrompt("Dirección del enlace (https://)","");
            if(!url||!/^https?:\/\//i.test(url))return;
            field.focus();
            if(savedRange&&field.contains(savedRange.commonAncestorContainer)){
                selection.removeAllRanges();selection.addRange(savedRange);
            }
            document.execCommand("createLink",false,url);
            return;
        }
        const actions={h2:["formatBlock","H2"],h3:["formatBlock","H3"],ul:["insertUnorderedList",null],clear:["removeFormat",null],bold:["bold",null],italic:["italic",null]};
        if(actions[kind])document.execCommand(actions[kind][0],false,actions[kind][1]);
        field.focus();
    });
    field.addEventListener("paste",event=>{
        event.preventDefault();
        document.execCommand("insertText",false,event.clipboardData?.getData("text/plain")||"");
    });
}
document.querySelectorAll(".rich-editor").forEach(setupRichEditor);



/**
 * Opens the entry dialog with an optional category suggestion.
 * @param category Selected category.
 * @return void.
 */
function openEntryDialog(category=null){
    resetEntryOptions();
    const chosen=canonicalCategory(category);
    $("entry-dialog-title").textContent=chosen?"Registrar · "+chosen:"Nueva entrada";
    $("entry-category").value=chosen||"";
    const preview=$("entry-category-preview");
    preview.classList.toggle("hidden",!chosen);
    preview.textContent=chosen?"Categoría: "+chosen:"";
    untouchedEntrySuggestion=chosen?quickDescription(chosen):null;
    if(chosen)setRichText("capture-text",untouchedEntrySuggestion,categoryStore.get(chosen).defaultHtml||"");
    $("entry-dialog").showModal();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function closeEntryDialog(){
    stopVoice();
    dismissDialog($("entry-dialog"));
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function reload(){
    entries=await storage.list();
    populateHistoryYears();
    if($("history").classList.contains("active"))drawHistory();
    drawCategories();drawSummary();drawSummaryPreview();drawDashboard();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function openEdit(e){
    current=e;mood=e.mood??null;
    setRichText("edit-text",e.description,e.descriptionHtml||"");
    populateTimeEditor("edit",e.startedAt||e.occurredAt,e.endedAt,e.duration);
    const availableCategories=categoryOptions();
    const entryCategory=canonicalCategory(e.category);
    $("edit-category").value=availableCategories.includes(entryCategory)?entryCategory:"";
    $("edit-notes").value=e.notes||"";
    $("edit-energy-enabled").checked=e.energy!=null;$("edit-energy").value=e.energy??5;
    renderEnergy("edit");setMood("edit",mood);
    $("edit-voice-status").textContent="";
    $("edit-dialog").showModal();
}

/** History fetches 25 matching records per request, directly from IndexedDB. */
const HISTORY_PAGE_SIZE=25;
const historyState={generation:0,loading:false,hasMore:false,next:null,loaded:0,groupKey:null,groupList:null,observer:null};
let historySearchTimer=null;

/**
 * Fills year choices from existing entries, retaining the selected year.
 * @return None.
 */
function populateHistoryYears(){
    const select=$("history-year");
    const chosen=select.value;
    const current=new Date().getFullYear();
    const years=new Set([current]);
    for(const e of entries){
        const year=new Date(e.occurredAt).getFullYear();
        if(Number.isInteger(year)&&year>=1900&&year<=9999)years.add(year);
    }
    select.replaceChildren(...[...years].sort((a,b)=>b-a).map(y=>new Option(String(y),String(y))));
    select.value=years.has(Number(chosen))?chosen:String(current);
}

/**
 * Returns inclusive local calendar bounds as an IndexedDB UTC time window.
 * @return Inclusive UTC time bounds.
 */
function historyBounds(){
    const mode=$("history-period").value;

    /**
     * Parses a local calendar date.
     * @param d Date value.
     * @return Local date.
     */
    const fromLocal=d=>new Date(d+"T00:00:00");

    /**
     * Converts a date to an ISO string.
     * @param d Date value.
     * @return ISO date string.
     */
    const asIso=d=>{
        if(!Number.isFinite(d.getTime()))throw Error("Revisá las fechas del filtro.");
        return d.toISOString();
    };
    if(mode==="year"){
        const year=Number($("history-year").value);
        if(!Number.isInteger(year)||year<1900||year>9998)throw Error("Elegí un año válido.");
        return {from:asIso(new Date(year,0,1)),to:asIso(new Date(year+1,0,1))};
    }
    if(mode==="month"){
        const month=$("history-month").value;
        if(!/^\d{4}-\d{2}$/.test(month))throw Error("Elegí un mes.");
        const [year,m]=month.split("-").map(Number);
        if(m<1||m>12)throw Error("Elegí un mes válido.");
        return {from:asIso(new Date(year,m-1,1)),to:asIso(new Date(year,m,1))};
    }
    if(mode==="range"){
        const from=$("history-from").value,to=$("history-to").value;
        if(from&&to&&from>to)throw Error("Desde no puede ser posterior a Hasta.");
        const end=to?fromLocal(to):null;
        if(end)end.setDate(end.getDate()+1);
        return {from:from?asIso(fromLocal(from)):null,to:end?asIso(end):null};
    }
    return {from:null,to:null};
}

/**
 * Returns a calendar-aware history heading.
 * @param value Entry date value.
 * @param now Current date.
 * @return History heading.
 */
function historyDateGroup(value,now=new Date()){
    const date=new Date(value);
    const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const diff=Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-
        Date.UTC(day.getFullYear(),day.getMonth(),day.getDate()))/86400000);
    const locale=currentAppLanguage()==="en"?"en-US":"es-AR";
    const es=locale==="es-AR";
    const dateKey=dayKey(value);
    if(diff===0)return {key:"d-"+dateKey,title:es?"Hoy":"Today",detail:"",recent:true};
    if(diff===1)return {key:"d-"+dateKey,title:es?"Ayer":"Yesterday",detail:"",recent:true};
    if(diff>=2&&diff<=6){
        const weekday=new Intl.DateTimeFormat(locale,{weekday:"long"}).format(date);
        const title=weekday.charAt(0).toLocaleUpperCase(locale)+weekday.slice(1);
        const detail=new Intl.DateTimeFormat(locale,{day:"numeric",month:"short"}).format(date);
        return {key:"d-"+dateKey,title,detail,recent:true};
    }
    const month=new Intl.DateTimeFormat(locale,{month:"long"}).format(date);
    return {key:"m-"+date.getFullYear()+"-"+date.getMonth(),
        title:month.charAt(0).toLocaleUpperCase(locale)+month.slice(1)+" "+date.getFullYear(),
        detail:"",recent:false};
}

/**
 * Appends one history item, keeping its edit behavior.
 * @param entry Entry to append.
 * @return None.
 */
function appendHistoryEntry(entry){
    const group=historyDateGroup(entry.occurredAt);
    const root=$("history-list");
    if(historyState.groupKey!==group.key){
        const section=el("section","history-group");
        const heading=el("h3","history-group-heading");
        heading.append(el("span","",group.title));
        if(group.detail)heading.append(el("small","",group.detail));
        const list=el("div","history-group-items");
        section.append(heading,list);root.append(section);
        historyState.groupKey=group.key;
        historyState.groupList=list;
    }
    const row=el("button","history-item");
    row.type="button";
    row.append(iconFor(entry.category));
    const body=el("span","item-main");
    body.append(el("strong","",entry.description));
    const date=new Date(entry.occurredAt);
    const dateText=group.recent?"":new Intl.DateTimeFormat(currentAppLanguage()==="en"?"en-US":"es-AR",
        {day:"numeric",month:"short"}).format(date)+" · ";
    const sub=el("small","",dateText+formatTime(entry.occurredAt));
    if(entry.category)sub.append(el("span","pill",canonicalCategory(entry.category)));
    if(entry.duration!=null)sub.append(document.createTextNode(" · "+durationLabel(entry.duration)));
    body.append(sub);row.append(body);
    if(entry.mood!=null)row.append(el("span","face",entry.mood>=7?"●":entry.mood<=3?"☹":"●"));
    row.setAttribute("aria-label","Editar registro: "+entry.description);
    row.onclick=()=>openEdit(entry);
    historyState.groupList.append(row);
}

/**
 * Reads the next matching cursor page after checking the active filter.
 * @return Completion promise.
 */
async function loadHistoryPage(){
    if(historyState.loading||!historyState.hasMore||!$("history").classList.contains("active"))return;
    const generation=historyState.generation;
    historyState.loading=true;
    const english=currentAppLanguage()==="en";
    $("history-indicator").textContent=english?"Loading entries…":"Cargando registros…";
    $("history-more").hidden=true;
    try{
        const {from,to}=historyBounds();
        const result=await storage.listPage({
            limit:HISTORY_PAGE_SIZE,after:historyState.next,from,to,
            query:$("search").value,category:categoryFilter
        });
        if(generation!==historyState.generation)return;
        for(const entry of result.items)appendHistoryEntry(entry);
        historyState.loaded+=result.items.length;
        historyState.next=result.next;
        historyState.hasMore=result.hasMore;
        if(!historyState.loaded){
            $("history-indicator").textContent=english?"No entries match these filters.":"No hay registros para estos filtros.";
        }else{
            $("history-indicator").textContent=historyState.hasMore
                ?historyState.loaded+(english?" entries loaded · Scroll to see more":" registros cargados · Deslizá para ver más")
                :historyState.loaded+(english?" entries":" registros");
        }
        $("history-more").hidden=!historyState.hasMore;
        $("history-sentinel").hidden=!historyState.hasMore;
    }catch(error){
        if(generation!==historyState.generation)return;
        $("history-indicator").textContent=error.message||(english?"Could not load history.":"No se pudo cargar el historial.");
        $("history-more").hidden=false;
        $("history-sentinel").hidden=true;
    }finally{
        if(generation===historyState.generation)historyState.loading=false;
    }
}

/**
 * Updates the collapsed search affordance for active filters.
 * @return None.
 */
function updateHistoryFilterState(){
    const query=$("search").value.trim();
    const mode=$("history-period").value;
    const english=currentAppLanguage()==="en";
    const parts=[];
    if(query)parts.push((english?"Text: ":"Texto: ")+query);
    if(mode==="year")parts.push($("history-year").value);
    else if(mode==="month"){
        const value=$("history-month").value;
        if(/^\d{4}-\d{2}$/.test(value)){
            const [year,month]=value.split("-").map(Number);
            parts.push(new Intl.DateTimeFormat(english?"en-US":"es-AR",{month:"long",year:"numeric"})
                .format(new Date(year,month-1,1)));
        }else parts.push(english?"Month":"Mes");
    }else if(mode==="range"){
        const start=$("history-from").value,end=$("history-to").value;
        parts.push([start,end].filter(Boolean).join(" – ")||(english?"Custom Range":"Rango personalizado"));
    }
    const active=Boolean(query)||mode!=="all";
    $("history-filter-state").textContent=active?parts.join(" · "):(english?"All entries":"Todos los registros");
    $("history-filters").classList.toggle("has-filters",active);
    $("history-clear").hidden=!active;
}

/**
 * Resets pagination and loads the first matching group of entries.
 * @return None.
 */
function drawHistory(){
    updateHistoryFilterState();
    ++historyState.generation;
    historyState.observer?.disconnect();
    historyState.observer=null;
    historyState.loading=false;
    historyState.hasMore=true;
    historyState.next=null;
    historyState.loaded=0;
    historyState.groupKey=null;
    historyState.groupList=null;
    $("history-list").replaceChildren();
    $("history-more").hidden=true;
    $("history-sentinel").hidden=false;
    $("history-indicator").textContent="";
    for(const mode of ["year","month","range"]){
        const fields=$("history-"+mode+"-fields");
        fields.hidden=$("history-period").value!==mode;
    }
    if(!$("history").classList.contains("active"))return;
    try{historyBounds()}catch(error){
        historyState.hasMore=false;
        $("history-sentinel").hidden=true;
        $("history-indicator").textContent=error.message;
        return;
    }
    if("IntersectionObserver" in window){
        historyState.observer=new IntersectionObserver(entries=>{
            if(entries.some(entry=>entry.isIntersecting))loadHistoryPage();
        },{rootMargin:"250px 0px"});
        historyState.observer.observe($("history-sentinel"));
    }
    loadHistoryPage();
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function drawCategories(){
    const root=$("category-list");root.replaceChildren();
    const allCategories=categoryNames();
    const names=allCategories.filter(name=>matchesCategorySearch(name,$("categories-search").value));
    for(const cat of names){
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
    if(!root.children.length){
        root.append(el("p","muted",allCategories.length?"No hay categorías que coincidan.":"No hay categorías. Agrega una con +."));
    }
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
    setRichText("cat-default-description",category?quickDescription(category):"",profile?.defaultHtml||"");
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
            name,keywords:words,defaultDescription:richText("cat-default-description"),defaultHtml:safeRichHTML($("cat-default-description").innerHTML),icon:categoryIcon,image:categoryImage,color:$("cat-color").value
        },original);
        if(original&&name!==original){
            for(const entry of entries.filter(e=>canonicalCategory(e.category)===original)){
    await storage.save({...entry,category:name});
            }
        }
        dismissDialog($("category-dialog"));
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
 * Draws a lightweight seven-day preview.
 * @return None.
 */
function drawSummaryPreview(){
    const {totals,inPeriod}=summaryBuckets(entries,"week");
    $("home-summary-total").textContent=String(inPeriod.length);
    $("home-summary-unit").textContent=inPeriod.length===1?"registro":"registros";
    const root=$("home-summary-bars");
    root.replaceChildren();
    const maximum=Math.max(1,...totals);
    for(const total of totals){
        const cell=el("span","home-summary-bar");
        cell.style.height=(total===0?3:Math.max(5,Math.round(total/maximum*42)))+"px";
        root.append(cell);
    }
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
    chart.dataset.period=period;
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
    const description=richText("capture-text");
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
            description,descriptionHtml:safeRichHTML($("capture-text").innerHTML),...timing,category,
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
            voiceFeedback(targetId, "Abriendo el dictado de Android…");
            const text = await native.recognize({language:currentAppLanguage()==="es"?"es-AR":"en-US"});
            if(requestId!==voiceRequestId || !field.closest("dialog")?.open)return;
            if(text){
    appendDictation(field,text);
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
        const session = {targetId,field,active:true,committed:"",restartTimer:null,voiceNode:null};
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
    if(!session.voiceNode){session.voiceNode=document.createElement("p");field.append(session.voiceNode);}
    session.voiceNode.textContent=[session.committed,finalized,interim].filter(Boolean).join(" ").trim();
    field.dispatchEvent(new Event("input",{bubbles:true}));
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
    if(session.voiceNode)session.voiceNode.textContent=session.committed;
    field.dispatchEvent(new Event("input",{bubbles:true}));
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
        else dismissDialog(dialog);
        return true;
    }
    const page=document.querySelector(".screen.active")?.id;
    if(["backup","analysis","language","sensory","about"].includes(page)){
        show("settings");
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
document.querySelectorAll(".view-back").forEach(b=>b.onclick=handleDeviceBack);
$("brand-home").onclick=()=>show("capture");
$("settings-button").onclick=()=>show("settings");
$("open-summary").onclick=()=>show("summary");
$("category-search").addEventListener("input",drawDashboard);
$("categories-search").addEventListener("input",drawCategories);
$("add-entry").onclick=()=>{
    const page=document.querySelector(".screen.active")?.id;
    if(page==="categories")openCategoryEditor();
    else if(page==="reminders")openReminderDialog();
    else if(page==="capture")openEntryDialog();
};
$("edit-close").onclick=()=>dismissDialog($("edit-dialog"));
$("edit-cancel").onclick=()=>dismissDialog($("edit-dialog"));
$("edit-dialog").addEventListener("close",stopVoice);
$("edit-dialog").addEventListener("cancel",stopVoice);
$("entry-close").onclick=closeEntryDialog;
$("entry-cancel").onclick=closeEntryDialog;
$("entry-dialog").addEventListener("close",stopVoice);
$("entry-dialog").addEventListener("cancel",stopVoice);
document.querySelectorAll("dialog").forEach(dialog=>{
    if(dialog.id==="app-action-dialog")return;
    dialog.addEventListener("cancel",event=>{
        event.preventDefault();
        if(dialog.id==="entry-dialog")closeEntryDialog();
        else dismissDialog(dialog);
    });
});
$("capture-save").onclick=saveCapture;
$("capture-text").addEventListener("input",()=>{untouchedEntrySuggestion=null;});

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

$("category-dialog-close").onclick=()=>dismissDialog($("category-dialog"));
$("cat-cancel").onclick=()=>dismissDialog($("category-dialog"));
$("cat-color").onchange=updateCategoryPreview;
$("cat-save").onclick=saveCategoryEditor;
$("cat-image-clear").onclick=()=>{categoryImage=null;$("cat-image").value="";updateCategoryPreview()};
$("cat-image").onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    $("cat-error").textContent="";
    try{categoryImage=await readCategoryImage(file);updateCategoryPreview();}
    catch(error){$("cat-error").textContent=error.message;}
};
$("search").oninput=()=>{
    clearTimeout(historySearchTimer);
    updateHistoryFilterState();
    historySearchTimer=setTimeout(drawHistory,180);
};
$("history-period").onchange=drawHistory;
for(const id of ["history-year","history-month","history-from","history-to"]){
    $(id).onchange=drawHistory;
}
$("history-clear").onclick=()=>{
    clearTimeout(historySearchTimer);
    $("search").value="";
    $("history-period").value="all";
    $("history-year").value=String(new Date().getFullYear());
    $("history-month").value=localTime(new Date()).slice(0,7);
    $("history-from").value="";
    $("history-to").value="";
    drawHistory();
};
$("history-more").onclick=loadHistoryPage;
$("history-month").value=localTime(new Date()).slice(0,7);
populateHistoryYears();
updateHistoryFilterState();
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
    $(prefix+"-clear-time").addEventListener("click",()=>{
        end.value="";
        populateDurationParts(prefix,null);
        timeInputMode[prefix]="none";
        refreshTimeEndCaption(prefix);
    });
}

$("edit-save").onclick=async()=>{
    if(!current)return;
    const description=richText("edit-text");if(!description){$("edit-text").focus();return;}
    try{
        const timing=timeDetails("edit");
        await storage.save({
            ...current,...timing,description,descriptionHtml:safeRichHTML($("edit-text").innerHTML),
            category:canonicalCategory($("edit-category").value)||null,
            categorySource:"manual",mood:readMood("edit"),
            energy:$("edit-energy-enabled").checked?Number($("edit-energy").value):null,
            notes:$("edit-notes").value
        });
        dismissDialog($("edit-dialog"));
        await reload();
    }catch(error){await appInfo(error.message,"No se pudieron guardar los cambios");}
};
$("edit-delete").onclick=async()=>{
    if(!current||!await appConfirm("¿Eliminar este registro?","Eliminar registro","Eliminar"))return;
    try{await storage.remove(current.id);dismissDialog($("edit-dialog"));await reload()}
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
    dismissDialog($("reminder-dialog"));
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
        dismissDialog($("reminder-dialog"));
        $("reminder-status").textContent=(editingReminderId?"Recordatorio actualizado.":"Recordatorio guardado.")+(reminderStore.status()?" "+reminderStore.status():"");
        editingReminderId=null;drawReminders();
    }catch(err){$("reminder-dialog-status").textContent=err.message}
};
$("reminder-delete").onclick=async()=>{
    if(!editingReminderId||!await appConfirm("¿Eliminar este recordatorio?","Eliminar recordatorio","Eliminar"))return;
    reminderStore.remove(editingReminderId);
    editingReminderId=null;dismissDialog($("reminder-dialog"));drawReminders();
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
    reducedMotionInput.checked=stored==="true";
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

;
/**
 * i18n.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const RH_TRANSLATIONS={"Buscar y filtrar":"Search and Filter","Todos los registros":"All Entries","Filtros":"Filters","Limpiar":"Clear","Limpiar búsqueda y filtros":"Clear search and filters","Período":"Period","Todas las fechas":"All Dates","Rango personalizado":"Custom Date Range","Mostrar más":"Load More","Cargando registros…":"Loading entries…","No hay registros para estos filtros.":"No entries match these filters.","Deslizá para ver más":"Scroll to see more","registros cargados":"entries loaded","Elegí un año válido.":"Choose a valid year.","Elegí un mes.":"Choose a month.","Elegí un mes válido.":"Choose a valid month.","Revisá las fechas del filtro.":"Check the filter dates.","Desde no puede ser posterior a Hasta.":"From cannot be later than To.","No se pudo cargar el historial.":"Could not load history.","Ver resumen":"View Summary","Configuración":"Settings","Ir a Registro":"Go to Entries","Busca y revisa tus registros.":"Search and review your entries.","Explora tus hábitos a lo largo del tiempo.":"Explore your habits over time.","Organiza tus avisos y sus horarios.":"Organize your reminders and their times.","Guarda una copia de tus datos o recupera un respaldo.":"Back up your data or restore an existing backup.","Exporta tus registros para analizarlos en otras herramientas.":"Export your entries for analysis in other tools.","Personaliza la aplicación y administra tus datos.":"Customize the app and manage your data.","Elige el idioma de la aplicación.":"Choose the app language.","Ajusta la apariencia y las animaciones a tu gusto.":"Adjust appearance and animations to your preferences.","Conoce Registro de Hábitos y sus características.":"Learn about Habit Tracker and its features.","Info de aplicación":"App Info","El archivo permanece fuera de la aplicación, por ejemplo en Descargas, aunque la desinstales.":"Your file remains outside the app, for example in Downloads, even if you uninstall it.","Incluye solo hábitos, sin configuraciones ni recordatorios.":"Includes only habit entries, without settings or reminders.","Un espacio para registrar tu día":"A Space to Record Your Day","Registro de Hábitos es una forma sencilla de recordar lo que haces, cómo te sientes y cómo cambia tu energía a lo largo del tiempo.":"Habit Tracker is a simple way to remember what you do, how you feel, and how your energy changes over time.","A tu ritmo":"At Your Own Pace","Puedes escribir o hablar, y guardar una actividad en pocos momentos. No tienes que completar todos los detalles ni hacerlo de una manera perfecta.":"You can type or speak and save an activity in a few moments. You don't have to fill in every detail or get everything perfect.","Comprender tus rutinas":"Understand Your Routines","Tu historial y los resúmenes te ayudan a reconocer hábitos, descansos y cambios cotidianos. También puedes usar recordatorios con sonidos suaves.":"Your history and summaries help you notice habits, rest, and everyday changes. You can also use reminders with gentle sounds.","Tus registros, a tu disposición":"Your Records, Your Choice","Los datos quedan en tu dispositivo. Puedes hacer una copia de seguridad y exportar tus registros cuando quieras utilizarlos en otras herramientas.":"Your data stays on your device. You can make a backup and export your records whenever you want to use them in other tools.","Un pequeño registro puede ayudarte a conocer mejor tus días.":"A small note can help you better understand your days.","Registro de Hábitos":"Habit Tracker","Ayuda":"Help","¿Cómo usar Registro de Hábitos?":"How to Use Habit Tracker","Puedes anotar lo que haces durante el día, cómo te sientes y cuánta energía tienes. No necesitas completar todo: registra solo lo que quieras.":"You can note what you do during the day, how you feel and how much energy you have. You do not have to fill in everything: record only what you want.","Agregar un registro":"Add an Entry","Elige una categoría en la pantalla principal o toca el botón +. Escribe lo que hiciste o utiliza el micrófono para dictarlo. Pulsa Guardar cuando termines.":"Choose a category on the home screen or tap +. Type what you did or use the microphone to dictate it. Tap Save when you are done.","¿Quieres añadir más detalles?":"Want to Add More Details?","En el formulario puedes indicar la hora, la duración, tu estado de ánimo, tu energía y alguna nota. Todos estos datos son opcionales.":"You can add the time, duration, mood, energy and notes. All of these are optional.","Consultar y corregir":"Review and Edit","En Historial puedes buscar tus registros. Toca uno para verlo, editarlo o eliminarlo. En Más puedes consultar un resumen de tus actividades.":"In History you can find your entries. Tap one to view, edit or delete it. In More you can see an activity summary.","Recordatorios tranquilos":"Gentle Reminders","En Recordatorios puedes crear avisos, elegir uno o varios horarios y escuchar los sonidos antes de guardarlos. También puedes activar o desactivar cada recordatorio.":"In Reminders you can create alerts, choose one or more times and preview sounds before saving. You can also turn each reminder on or off.","Adaptar la aplicación a tus necesidades":"Make the App Comfortable for You","En Más puedes organizar las categorías, elegir el idioma, cambiar entre modo oscuro y claro o desactivar las animaciones.":"In More you can organize categories, choose a language, switch between dark and light mode or turn off animations.","Guardar y compartir tus registros":"Save and Share Your Entries","En Más, Respaldo y restauración te permite guardar una copia de seguridad en el teléfono. Exportar para análisis te permite obtener tus registros para utilizarlos en otras herramientas.":"In More, Backup and Restore lets you save a backup on your phone. Export for Analysis lets you use your entries in other tools.","Nuevo registro":"New Entry","Elige una categoría para completar y guardar tu entrada.":"Choose a category to complete and save your entry.","Hoy":"Today","registros":"entries","registro":"entry","Deshacer":"Undo","Categorías":"Categories","Edita nombres, palabras clave e íconos. Los registros anteriores se conservan.":"Edit names, keywords and icons. Previous entries are preserved.","Semana":"Week","Mes":"Month","Año":"Year","Nuevo recordatorio":"New Reminder","Nombre":"Name","Horarios del día":"Times of Day","+ Agregar horario":"+ Add Time","Frecuencia":"Frequency","Todos los días":"Every Day","Días de semana":"Weekdays","Una vez":"Once","Sonido":"Sound","Glockenspiel":"Glockenspiel","Notificación suave":"Soft Notification","Silencioso":"Silent","Sin avisos anticipados. Android usa el volumen de notificaciones del teléfono.":"No advance alerts. Android uses the phone's notification volume.","Cancelar":"Cancel","Guardar":"Save","Eliminar":"Delete","Respaldo y restauración":"Backup and Restore","Guarda una copia completa fuera de la app, por ejemplo en Descargas. El archivo permanece aunque desinstales Registro Hábitos.":"Save a full backup outside the app, for example in Downloads. The file remains if you uninstall the app.","Guardar respaldo en el teléfono":"Save Backup to Phone","Restaurar desde un respaldo":"Restore from Backup","Incluye hábitos, categorías, imágenes, recordatorios y preferencias. Al restaurar, los registros existentes se conservan.":"Includes habits, categories, images, reminders and preferences. Existing entries are kept when restoring.","Exportar para análisis":"Export for Analysis","Exporta solamente tus registros de hábitos, sin configuraciones ni recordatorios. Puedes usarlos en otras herramientas.":"Export only your habit entries, without app settings or reminders. You can use them in other tools.","Filtrar por fecha":"Filter by Date","Puedes dejar una fecha vacía. Ambos días están incluidos.":"Either date can be left blank. Both dates are included.","Desde":"From","Hasta":"To","Deja las fechas vacías para incluir todos los registros. Ambos días están incluidos.":"Leave the dates blank to include all entries. Both dates are included.","Exportar hábitos JSON":"Export Habits JSON","Exportar hábitos CSV":"Export Habits CSV","Resumen":"Summary","Acerca de":"About","Preferencias sensoriales":"Sensory Preferences","Modo oscuro":"Dark Mode","Sin animaciones":"No Animations","Sin avisos anticipados.":"No advance alerts.","Versión":"Version","Compilación":"Build","Autor":"Author","Editar registro":"Edit Entry","¿Qué hiciste o cómo te sientes?":"What did you do or how did you feel?","Toca para dictar":"Tap to Dictate","Fecha":"Date","Hora":"Time","Categoría":"Category","Estado de ánimo":"Mood","Horario":"Time","Inicio":"Start","Agregar fin":"Add End","Fin":"End","Duración calculada":"Calculated Duration","Duración":"Duration","Horas":"Hours","Minutos":"Minutes","Energía":"Energy","Notas":"Notes","Cerrar":"Close","Eliminar registro":"Delete Entry","Palabras clave":"Keywords","Se utilizan para buscar y sugerir automáticamente esta categoría.":"Used to search and automatically suggest this category.","Color":"Color","Verde suave":"Soft Green","Azul":"Blue","Violeta":"Purple","Naranja":"Orange","Gris":"Gray","Imagen propia o foto":"Custom Image or Photo","Quitar imagen":"Remove Image","La imagen se ajusta y guarda en este dispositivo. No se sube a internet.":"The image is resized and stored on this device. It is not uploaded.","Elegir un ícono":"Choose an Icon","Confirmación":"Confirmation","Aceptar":"OK","Nueva entrada":"New Entry","Detalles opcionales":"Optional Details","Fecha y hora":"Date and Time","Registro":"Entries","Historial":"History","Recordatorios":"Reminders","Más":"More","Idioma":"Language","Idioma de la aplicación":"App Language","Sistema operativo":"System Default","Español":"Spanish","English":"English","De forma predeterminada, se utiliza el idioma del dispositivo.":"Uses your device language by default.","Actividad física":"Physical Activity","Alimentación":"Food","Terapia":"Therapy","Salud":"Health","Sueño":"Sleep","Emociones":"Emotions","Cognitivo":"Cognitive","Ocio":"Leisure","Trabajo":"Work","Personal":"Personal","Hidratación":"Hydration","Descanso":"Rest","Salida":"Going Out","Social":"Social","Higiene":"Hygiene","Ir al baño":"Bathroom","Tabaco":"Tobacco","Vapeo":"Vaping","Alcohol":"Alcohol","Medicación":"Medication","Cafeína":"Caffeine","Buscar categoría":"Search Categories","Sin categoría":"Uncategorized","Sin palabras clave":"No keywords","No hay categorías que coincidan.":"No matching categories.","No hay categorías. Agrega una con +.":"No categories yet. Add one with +.","Aún no has registrado nada hoy.":"No entries today yet.","Todavía no hay registros para mostrar.":"No entries to show.","Automática":"Automatic","Manual":"Manual","Nueva categoría":"New Category","Editar categoría":"Edit Category","Crear categoría":"Create Category","Guardar cambios":"Save","Confirmar":"Confirm","Información":"Information","Nueva entrada de ":"New entry for ","Categoría: ":"Category: ","Últimos 7 días":"Last 7 days","Últimos 30 días":"Last 30 days","Últimos 12 meses":"Last 12 months","Selecciona un respaldo ZIP.":"Select a ZIP backup.","No hay registros en ese período.":"No entries in that date range.","Entrada guardada":"Entry saved","Recordatorio guardado.":"Reminder saved.","Recordatorio actualizado.":"Reminder updated.","Escuchar audio":"Play Sound","Detener dictado":"Stop Dictation","Iniciar dictado":"Start Dictation","Escuchando… Toca otra vez para detener.":"Listening… Tap again to stop.","Escuchando… puedes hacer pausas. Toca para detener.":"Listening… You can pause. Tap to stop.","Dictado detenido.":"Dictation stopped.","Salir de la app":"Exit App","¿Quieres salir de Registro Hábitos?":"Do you want to exit Registro Hábitos?","Salir":"Exit","Guardar respaldo":"Save Backup","Restaurar":"Restore","Muy mal":"Very Bad","Mal":"Bad","Neutral":"Neutral","Bien":"Good","Muy bien":"Very Good"};
const RH_ALTERNATES={"Elegí":"Elige","Editá":"Edita","Agregá":"Agrega","Guardá":"Guarda","Exportá":"Exporta","Dejá":"Deja","Podés":"Puedes","Tocá":"Toca","Usá":"Usa","Ingresá":"Ingresa","Comprobá":"Comprueba","Activá":"Activa","Escribí":"Escribe"};
const RH_LANGUAGE_KEY="registro-habitos-language";

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function languagePreference(){try{return localStorage.getItem(RH_LANGUAGE_KEY)||"system"}catch{return "system"}}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function systemAppLanguage(){const locale=navigator.languages?.[0]||navigator.language||"es";return /^es(?:-|$)/i.test(locale)?"es":"en"}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function currentAppLanguage(){const preference=languagePreference();return preference==="system"?systemAppLanguage():preference==="en"?"en":"es"}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function setLanguagePreference(value){
    const preference=["system","es","en"].includes(value)?value:"system";
    try{localStorage.setItem(RH_LANGUAGE_KEY,preference)}catch(error){console.warn(error)}
    const selector=document.getElementById("app-language");
    if(selector)selector.value=preference;
    applyAppLanguage();
}
const RH_REVERSE=Object.fromEntries(Object.entries(RH_TRANSLATIONS).map(([es,en])=>[en,es]));

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
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
