#!/bin/sh
# Smoke-test the exact local HTML that KCAPK will package.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/build.sh" --prepare-only
PAGE="$ROOT/build/web/app.html"
MIGRATOR="$ROOT/build/web/index.html"
test -s "$MIGRATOR"
grep -q "appassets.androidplatform.net/app.html" "$MIGRATOR"
test -s "$PAGE"
grep -q 'name="app-build"' "$PAGE"
grep -q 'id="build-version"' "$PAGE"
grep -q 'id="capture-save"' "$PAGE"
grep -q 'id="capture-text"' "$PAGE"
grep -q 'id="quick-categories"' "$PAGE"
grep -q 'id="category-search"' "$PAGE"
grep -q 'function matchesCategorySearch(category,query)' "$PAGE"
grep -q 'id="entry-dialog"' "$PAGE"
grep -q 'id="entry-status"' "$PAGE"
for prefix in entry edit; do
    grep -q "id=\"$prefix-hours\"" "$PAGE"
    grep -q "id=\"$prefix-minutes\"" "$PAGE"
    grep -q "id=\"$prefix-duration\" type=\"hidden\"" "$PAGE"
done
if grep -q 'Calcular con inicio y fin' "$PAGE"; then
    echo 'Old interval fields remain' >&2
    exit 1
fi
grep -q 'function updateDurationFromParts(prefix)' "$PAGE"
grep -q 'id="add-entry"' "$PAGE"
grep -q 'id="undo-quick"' "$PAGE"
grep -q 'id="dismiss-feedback"' "$PAGE"
grep -q 'class="entry-modal-actions"' "$PAGE"
if grep -q '#capture-save{display:block;width:100%;margin-top:46px' "$ROOT/web/style.css"; then
 echo 'Old button margin breaks alignment' >&2
 exit 1
fi
grep -q 'id="entry-cancel" class="secondary">Cerrar' "$PAGE"
grep -q '\$("dismiss-feedback").onclick=()=>showCaptureFeedback("")' "$PAGE"
grep -q 'function openEntryDialog(category=null)' "$PAGE"
grep -q 'id="entry-category-preview"' "$PAGE"
grep -q 'button.onclick=()=>openEntryDialog(category)' "$PAGE"
if grep -q 'function saveQuickCategory(category)' "$PAGE"; then
    echo 'Category button must not save without confirmation' >&2
    exit 1
fi
if grep -q 'id="suggestions"' "$PAGE"; then
    echo 'Old suggestions menu is still packaged' >&2
    exit 1
fi
grep -q 'id="edit-save"' "$PAGE"
grep -q 'id="reminder-confirm"' "$PAGE"
grep -q 'id="app-action-dialog"' "$PAGE"
grep -q 'id="test-notification"' "$PAGE"
grep -q 'id="test-closed-notification"' "$PAGE"
grep -q 'async testClosed(title,sound)' "$PAGE"
grep -q -- '--permission exactAlarm' "$ROOT/build.sh"
grep -q 'AlarmBridge.schedule(context, options, true)' "$ROOT/native/AlarmReceiver.java.in"
grep -q 'JSONObject recurrence = scheduled.optJSONObject("recurrence")' "$ROOT/native/AlarmReceiver.java.in"
grep -q 'alarm_file = templates / "AlarmBridge.java.in"' "$ROOT/scripts/patch-kcapk.py"
grep -q 'id="reminder-dialog-status"' "$PAGE"
grep -q 'function showAppDialog({' "$PAGE"
if grep -Eq '(^|[^[:alnum:]_])(alert|confirm|prompt)[[:space:]]*\\(' "$ROOT/web/app.js"; then
    echo 'Native JavaScript dialogs are not allowed in the app' >&2
    exit 1
fi
grep -q 'id="reminder-delete"' "$PAGE"
grep -q 'id="reminder-dialog-title"' "$PAGE"
grep -q 'async update(id,changes)' "$PAGE"
grep -q 'function openReminderDialog(item=null)' "$PAGE"
grep -q 'edit.onclick=()=>openReminderDialog(item)' "$PAGE"
# Verify the direct KCAPK entry point uses the same newly generated bundle.
cmp "$ROOT/web/app.bundle.js" "$ROOT/build/web/app.bundle.js"
if grep -q 'id="reminder-new"' "$PAGE"; then
    echo 'Duplicate header detected in packaged UI' >&2
    exit 1
fi
if grep -q 'id="reminder-new"' "$PAGE"; then
    echo 'Duplicate reminder add control was generated' >&2
    exit 1
fi
grep -q 'i-toilet' "$PAGE"
grep -q 'i-vape' "$PAGE"
grep -q 'i-glass' "$PAGE"
grep -q 'const reminderStore =' "$PAGE"
grep -q 'id="summary"' "$PAGE"
grep -q 'id="categories"' "$PAGE"
grep -q 'id="export-json"' "$PAGE"
grep -q 'id="import-json"' "$PAGE"
grep -q 'id="reminder-list"' "$PAGE"
grep -q 'const storage =' "$PAGE"
grep -q 'function suggestCategory' "$PAGE"
grep -q 'document.getElementById' "$PAGE"
if grep -q 'type="module"\|src="./app.bundle.js"' "$PAGE"; then
    echo 'Unexpected external JavaScript module in packaged HTML' >&2
    exit 1
fi
if command -v node >/dev/null 2>&1; then
    # Check the generated application script rather than separately checking
    # modules that deliberately contain import/export declarations.
    node --check "$ROOT/build/web/app.bundle.js"
    node - "$ROOT" <<'NODE'
const fs=require("fs"), root=process.argv[2];
const source=fs.readFileSync(root+"/web/app.js","utf8");
const searchHelpers=source.slice(source.indexOf("function quickDescription("),source.indexOf("function drawDashboard(){"));
const matching=new Function(searchHelpers+"; return matchesCategorySearch")();
const examplesSearch=[
 ["fum","Tabaco",true],["cigarrillo","Tabaco",true],
 ["vap","Vapeo",true],["pis","Ir al baño",true],
 ["cafe","Cafeína",true],["FÍSICA","Actividad física",true],
 ["fum","Vapeo",false],["cerveza","Tabaco",false]
];
for(const [query,category,expected] of examplesSearch){
 if(matching(category,query)!==expected)throw Error("Category filter failed: "+query+" / "+category);
}
// Check only the visible hours/minutes and the hidden total.
const durationSource=source.slice(source.indexOf("function durationLabel("),source.indexOf("function createEntry(details)"));
const controls=new Map();
for(const prefix of ["entry","edit"]){
 for(const part of ["hours","minutes","duration"])controls.set(prefix+"-"+part,{value:""});
}
controls.set("entry-when",{value:"2026-10-22T12:00"});
controls.set("edit-date",{value:"2026-10-22"});controls.set("edit-time",{value:"12:00"});
const get=id=>controls.get(id);
const duration=new Function("$",durationSource+";return {durationDetails,updateDurationFromParts,populateDurationParts}")(get);
get("entry-hours").value="4";get("entry-minutes").value="0";
duration.updateDurationFromParts("entry");
if(get("entry-duration").value!=="240"||duration.durationDetails("entry").duration!==240)throw Error("4h must equal 240min");
get("edit-hours").value="1";get("edit-minutes").value="30";
duration.updateDurationFromParts("edit");
if(duration.durationDetails("edit").duration!==90)throw Error("1h30m must equal 90min");
get("entry-hours").value="";get("entry-minutes").value="";
duration.updateDurationFromParts("entry");
if(get("entry-duration").value!==""||duration.durationDetails("entry").duration!==null)throw Error("Duration must be optional");
get("edit-minutes").value="75";
let invalid=false;try{duration.durationDetails("edit")}catch(error){invalid=/minutos/.test(error.message)}
if(!invalid)throw Error("Minutes must be 0–59");
duration.populateDurationParts("edit",245);
if(get("edit-hours").value!=="4"||get("edit-minutes").value!=="5")throw Error("Historical duration not displayed");
if(!source.includes('"startedAt","endedAt"'))throw Error("Existing historical fields no longer export");
// Native alarm delivery must use audible Android channels, not WebView audio.
const remindersSource=fs.readFileSync(root+"/web/reminders.js","utf8");
const channels=[],alarms=[],notifications=[];
const prefs=new Map();
const store=new Function("window","localStorage",remindersSource+";return reminderStore")(
 {NativeBridge:{Android:{
  alarms:{canScheduleExact(){return false},cancel(){return true},schedule(o){alarms.push(o);return true}},
  notifications:{canPost(){return true},createChannel(o){channels.push(o);return true},post(o){notifications.push(o);return true}},
  permissions:{request:async()=>true}
 }}},
 {getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v)}
);
store.schedule({id:"550000",base:550000,title:"Siesta",time:"12:00",repeat:"daily",sound:"glock",enabled:true});
const channel=channels.at(-1),first=alarms[0];
if(!channel||channel.importance!=="default"||!channel.sound.endsWith("/registro_glock"))
 throw Error("Audible reminder channel not configured");
if(!first||first.allowWhileIdle!==true||first.action.channel!==channel.id||
 first.action.sound!==channel.sound||first.action.type!=="notification")
 throw Error("Background alarm does not deliver an audible native notification");
if(alarms.length!==1||first.recurrence?.mode!=="daily"||
 first.recurrence.hour!==12||first.recurrence.minute!==0)
 throw Error("Only the next event should be scheduled, with native recurrence metadata");
if(alarms[0].exact!==false)throw Error("Inexact fallback should be used without exact permission");
if(channel.id==="registro-soft")throw Error("Reused permanently silent Android channel");
store.schedule({id:"550100",base:550100,title:"Descanso",time:"16:00",repeat:"once",sound:"none",enabled:true});
if(channels.at(-1).sound!=="none"||channels.at(-1).importance!=="low")
 throw Error("Explicitly silent reminders must remain silent");
const once=alarms[1];
if(!once||once.recurrence!==null)throw Error("A once-only reminder must not repeat");
if(!remindersSource.includes('permissions.request("exactAlarm")'))
 throw Error("Exact alarm permission is never requested");
if(!remindersSource.includes('async testClosed(title,sound)'))
 throw Error("No closed-app alarm test is available");
const file=fs.readFileSync(root+"/web/classifier.js","utf8").replace("export function suggestCategory","function suggestCategory");
const categorize=new Function(file+"; return suggestCategory")();
const examples=[
 ["Fui al baño","Ir al baño"],["Hice pis","Ir al baño"],["Evacué","Ir al baño"],
 ["Me bañé","Higiene"],["Me duché","Higiene"],
 ["Fumé un cigarrillo","Tabaco"],["Vapeé","Vapeo"],["Usé el cigarrillo electrónico","Vapeo"],
 ["Tomé una cerveza","Alcohol"],["Tomé agua","Hidratación"],["Tomé café","Cafeína"],["Tomé una pastilla","Medicación"]
];
for(const [sentence,expected] of examples){
 const actual=categorize(sentence,[])?.category;
 if(actual!==expected)throw Error(sentence+": expected "+expected+", got "+actual);
}
NODE
fi
echo 'Packaged WebView HTML smoke test passed'
