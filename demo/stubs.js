/**
 * stubs.js - Browser-only substitutes for Android APIs.
 * Summary: Keeps the packaged interface usable without native Android services.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */
(function(){
    "use strict";
    const alarms=new Map();
    const notifications={
        canPost:()=>true,
        createChannel:()=>true,
        post:()=>true,
        notify:()=>true
    };
    const alarmBridge={
        canScheduleExact:()=>true,
        schedule:details=>{alarms.set(details.id,details);return true;},
        cancel:id=>{alarms.delete(id);return true;}
    };
    const permissions={
        has:()=>true,
        request:async()=>true
    };
    // No native voice stub: the app falls back to the browser SpeechRecognition API.
    window.NativeBridge={
        Android:{alarms:alarmBridge,notifications,permissions},
        showToast:message=>console.info("[Demo]",message)
    };
    window.AndroidBridge=window.NativeBridge;
    window.__REGISTRO_HABITOS_DEMO__=true;
})();
