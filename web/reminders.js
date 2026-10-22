// Local persistent reminder definitions; Android alarms are independent of WebView lifetime.
const REMINDER_KEY="registro-habitos-reminders";
const REMINDER_MAX_TIMES=29; // Reserved native IDs: base ... base + 28
const REMINDER_TIME_RE=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const reminderStore={
 list(){try{return JSON.parse(localStorage.getItem(REMINDER_KEY)||"[]")}catch{return []}},
 persist(items){localStorage.setItem(REMINDER_KEY,JSON.stringify(items))},
 normalizeTimes(value){
  const source=Array.isArray(value)?value:[value];
  if(!source.length||source.length>REMINDER_MAX_TIMES)
   throw Error("Elegí entre 1 y "+REMINDER_MAX_TIMES+" horarios.");
  const times=source.map(time=>typeof time==="string"?time.trim():"");
  if(times.some(time=>!REMINDER_TIME_RE.test(time)))throw Error("Completá todos los horarios con una hora válida.");
  if(new Set(times).size!==times.length)throw Error("Hay horarios repetidos. Elegí horas diferentes.");
  return times.sort();
 },
 timesFor(item){
  return this.normalizeTimes(Array.isArray(item.times)&&item.times.length?item.times:item.time);
 },
 cancel(item){
  const api=this.api();
  if(api)for(let index=0;index<REMINDER_MAX_TIMES;index++)api.cancel(item.base+index);
 },
 api(){return window.NativeBridge?.Android?.alarms},
 lastWarning:"",
 status(){return this.lastWarning;},
 channel(sound){
  // Every sound has its own Android notification channel. Channels are
  // immutable once created: v3 avoids the legacy low-importance silent channel.
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
 soundUri(sound){
  const names={glock:"registro_glock",alert:"registro_alert"};
  const name=names[sound];
  return name?"android.resource://com.kaisarcode.registrohabitos/raw/"+name:"none";
 },
 async permission(){
  const a=window.NativeBridge?.Android;
  if(!a?.alarms||!a?.notifications)throw Error("Alarmas y notificaciones nativas no disponibles en este APK.");
  if(!a.notifications.canPost()){
   if(!a.permissions||!await a.permissions.request("notifications")||!a.notifications.canPost()){
    throw Error("Activá las notificaciones de Registro Hábitos en los ajustes de Android.");
   }
  }
  this.lastWarning="";
  // On recent Android, exact alarms require separate special app access.
  // Ask only when a user explicitly saves/enables a reminder, not on startup.
  if(a.alarms.canScheduleExact && !a.alarms.canScheduleExact()){
   try{
    if(a.permissions?.request)await a.permissions.request("exactAlarm");
   }catch(error){console.warn("Exact alarm permission request unavailable",error);}
   if(!a.alarms.canScheduleExact()){
    this.lastWarning="Android no autorizó alarmas puntuales. El aviso puede retrasarse cuando el teléfono está en reposo.";
   }
  }
 },
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
 // Android reserves one persistent native alarm per scheduled hour. Each
 // daily/weekday alarm independently schedules its next occurrence in
 // AlarmReceiver, so a WebView or foreground service is never required.
 schedule(item){
  const api=this.api();
  if(!api)throw Error("Alarmas nativas no disponibles.");
  const times=this.timesFor(item);
  this.cancel(item); // Also clears all slots from the old single-time build.
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
 async testClosed(title,sound){
  await this.permission();
  const selected=sound||"glock",channel=this.channel(selected);
  const api=this.api(),exact=api.canScheduleExact?.()===true;
  const ok=api.schedule({
   id:19002027,at:Date.now()+90000,exact,allowWhileIdle:true,
   action:{
    type:"notification",id:19002027,channel,
    title:title||"Prueba de recordatorio",text:"Prueba con la app cerrada",
    sound:this.soundUri(selected),
    importance:selected==="none"?"low":"default",onlyAlertOnce:false
   }
  });
  if(!ok)throw Error("Android no pudo programar la prueba con la app cerrada.");
  return exact;
 },
 async test(title,sound){
  await this.permission();
  const selected=sound||"none",channel=this.channel(selected);
  const notifications=window.NativeBridge.Android.notifications;
  const ok=notifications.post({
   id:19002026,channel,title:title||"Prueba de recordatorio",
   text:"Prueba de notificación",importance:selected==="none"?"low":"default",
   sound:this.soundUri(selected),onlyAlertOnce:false
  });
  if(!ok)throw Error("Android rechazó la notificación de prueba.");
 },
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
 remove(id){
  const list=this.list(),item=list.find(x=>x.id===id);
  if(item)this.cancel(item);
  this.persist(list.filter(x=>x.id!==id));
 },
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
