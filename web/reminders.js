// Local persistent reminder definitions; Android alarms are independent of WebView lifetime.
const REMINDER_KEY="registro-habitos-reminders";
const reminderStore={
 list(){try{return JSON.parse(localStorage.getItem(REMINDER_KEY)||"[]")}catch{return []}},
 persist(items){localStorage.setItem(REMINDER_KEY,JSON.stringify(items))},
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
 nextOccurrence(item){
  const [hour,minute]=item.time.split(":").map(Number);
  if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)
   throw Error("La hora del recordatorio no es válida.");
  if(item.repeat==="once"&&Number.isFinite(item.onceAt)){
   return item.onceAt>Date.now()?item.onceAt:null;
  }
  const day=new Date();
  day.setHours(hour,minute,0,0);
  // Android's native receiver will schedule subsequent repeats. Only the
  // closest occurrence needs to be registered from the WebView.
  for(let i=0;i<8;i++){
   if(day.getTime()>Date.now() &&
      (item.repeat!=="weekdays"||(day.getDay()!==0&&day.getDay()!==6)))
    return day.getTime();
   day.setDate(day.getDate()+1);
  }
  return null;
 },
 schedule(item){
  const api=this.api();
  if(!api)throw Error("Alarmas nativas no disponibles.");
  // Cancel the 28-day batch from older app builds when migrating.
  for(let i=0;i<29;i++)api.cancel(item.base+i);
  const at=this.nextOccurrence(item);
  if(at===null)return false;
  const soundName=item.sound||"none",channel=this.channel(soundName);
  const exact=typeof api.canScheduleExact==="function"&&api.canScheduleExact();
  const [hour,minute]=item.time.split(":").map(Number);
  const recurrence=item.repeat==="once"?null:{
   mode:item.repeat==="weekdays"?"weekdays":"daily",hour,minute
  };
  const ok=api.schedule({
   id:item.base,at,exact,allowWhileIdle:true,recurrence,
   action:{
    type:"notification",id:item.base,channel,title:item.title,
    text:"Recordatorio",importance:soundName==="none"?"low":"default",
    onlyAlertOnce:false,sound:this.soundUri(soundName)
   }
  });
  if(!ok)throw Error("Android no pudo programar el recordatorio.");
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
 async add(title,time,daily,repeat,sound){
  await this.permission();const entries=this.list();
  // Native alarm IDs must fit signed Android int and remain stable across runs.
  const used=new Set(entries.map(x=>x.base));
  let base;
  do{base=100000+Math.floor(Math.random()*45000000)*32}while(used.has(base));
  const cadence=repeat|| (daily?"daily":"once");
  const item={id:String(base),base,title,time,daily:!!daily,repeat:cadence,sound:sound||"glock",enabled:true};
  if(cadence==="once")item.onceAt=this.nextOccurrence(item);
  this.schedule(item);entries.push(item);this.persist(entries);return item;
 },
 async update(id,changes){
  const items=this.list(),index=items.findIndex(item=>item.id===id);
  if(index<0)throw Error("El recordatorio ya no existe.");
  const current=items[index];
  const updated={...current,title:changes.title,time:changes.time,repeat:changes.repeat,daily:changes.daily,sound:changes.sound};
  if(changes.repeat==="once"){
   updated.onceAt=(current.repeat==="once"&&current.time===changes.time&&current.onceAt>Date.now())
    ?current.onceAt:this.nextOccurrence({...updated,onceAt:null});
  }else{delete updated.onceAt;}
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
  if(enabled){
   await this.permission();
   if(item.repeat==="once"&&(!item.onceAt||item.onceAt<=Date.now()))
    item.onceAt=this.nextOccurrence({...item,onceAt:null});
   this.schedule({...item,enabled:true});
  }
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
  const items=this.list();
  let changed=false;
  for(const item of items){
   if(!item.enabled)continue;
   if(item.repeat==="once"&&item.onceAt&&item.onceAt<=Date.now()){
    item.enabled=false;
    changed=true;
    continue;
   }
   try{
    if(item.repeat==="once"&&!item.onceAt){
     item.onceAt=this.nextOccurrence(item);
     changed=true;
    }
    this.schedule(item);
   }catch(error){console.warn("Alarm restoration",error);}
  }
  if(changed)this.persist(items);
 }
};
