// Offline reminders; native KCAPK alarms trigger without an open WebView.
const REMINDER_KEY = "registro-habitos-reminders";
const reminderStore = {
    list() { try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || "[]"); } catch (_) { return []; } },
    persist(items) { localStorage.setItem(REMINDER_KEY, JSON.stringify(items)); },
    api() { return window.NativeBridge?.Android?.alarms; },
    async add(title, time, daily) {
        const alarms=this.api();
        if (!alarms) throw new Error("Las alarmas requieren KCAPK en Android.");
        if (window.NativeBridge.Android.permissions && window.NativeBridge.Android.notifications &&
            !window.NativeBridge.Android.notifications.canPost()) {
            const granted=await window.NativeBridge.Android.permissions.request("notifications");
            if (!granted) throw new Error("Permiso de notificaciones denegado.");
        }
        const native=window.NativeBridge.Android;
        if (native.notifications) native.notifications.createChannel({
            id:"registro-discreto",name:"Recordatorios discretos",importance:"low",sound:"none",showBadge:false
        });
        const base=Math.floor(Math.random()*1500000)*32;
        const item={id:String(base),base,title,time,daily};
        const [hour,minute]=time.split(":").map(Number);
        for (let n=0;n<(daily?28:1);n++) {
            const when=new Date();when.setHours(hour,minute,0,0);
            if (when.getTime()<=Date.now()) when.setDate(when.getDate()+1);
            when.setDate(when.getDate()+n);
            const scheduled=alarms.schedule({id:base+n,at:when.getTime(),exact:false,
                action:{type:"notification",id:base+n,channel:"registro-discreto",
                    title,text:"Recordatorio",onlyAlertOnce:true,sound:"none"}});
            if(!scheduled) throw new Error("Android no pudo programar el recordatorio.");
        }
        const items=this.list();items.push(item);this.persist(items);return item;
    },
    remove(id) {
        const items=this.list(), item=items.find(x=>x.id===id);
        if(item && this.api()) for(let n=0;n<(item.daily?28:1);n++)this.api().cancel(item.base+n);
        this.persist(items.filter(x=>x.id!==id));
    }
};
