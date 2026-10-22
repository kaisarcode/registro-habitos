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
