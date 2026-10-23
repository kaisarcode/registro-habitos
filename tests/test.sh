#!/bin/sh
# Smoke-test the exact local HTML that KCAPK will package.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# Rebuild must discard stale generated resources, not package old leftovers.
mkdir -p "$ROOT/build/web"
printf 'stale\n' > "$ROOT/build/web/stale-asset-check.txt"
"$ROOT/build.sh" --prepare-only
if [ -e "$ROOT/build/web/stale-asset-check.txt" ]; then
    echo 'Previous build/web assets leaked into this build' >&2
    exit 1
fi
grep -Fq 'VERSION_BASE_COMMIT=45101558a0541ac69f3454efaae6bfe07f5fe6f4' "$ROOT/build.sh"
grep -Fq -- '--version-code "$VERSION_CODE"' "$ROOT/build.sh"
PAGE="$ROOT/build/web/app.html"
MIGRATOR="$ROOT/build/web/index.html"
test -s "$MIGRATOR"
grep -q "appassets.androidplatform.net/app.html" "$MIGRATOR"
test -s "$PAGE"
grep -q 'name="app-build"' "$PAGE"
grep -q 'id="about-version"' "$PAGE"
grep -q 'id="dark-mode" type="checkbox" role="switch" checked' "$PAGE"
grep -Fq 'function applyDarkMode(enabled)' "$PAGE"
grep -Fq 'darkMode:$("dark-mode").checked' "$PAGE"
grep -Fq 'backup.preferences.darkMode' "$PAGE"
grep -Fq 'html.theme-light' "$ROOT/web/style.css"
grep -q 'id="about-build"' "$PAGE"
grep -q 'data-page="about"' "$PAGE"
grep -q 'href="https://kaisarcode.com"' "$PAGE"
grep -q 'meta name="app-version"' "$PAGE"
grep -q 'meta name="app-version-code"' "$PAGE"
grep -Fq 'APP_VERSION="0.3.3"' "$ROOT/build.sh"
grep -Fq 's/@APP_VERSION@/$APP_VERSION/g' "$ROOT/build.sh"
grep -Fq -- '--version-name "$APP_VERSION"' "$ROOT/build.sh"
grep -Fq '["categories","summary","backup","analysis","about"].includes(page)' "$PAGE"
grep -Fq '$("back").onclick=handleDeviceBack' "$PAGE"
grep -q 'id="capture-save"' "$PAGE"
grep -q 'id="capture-text"' "$PAGE"
grep -q 'id="quick-categories"' "$PAGE"
grep -q 'id="category-search"' "$PAGE"
grep -q 'id="category-dialog"' "$PAGE"
# Categories uses the global header action instead of an offset secondary +.
if grep -q 'id="category-add"\|class="category-page-actions"' "$PAGE"; then
    echo 'Category add control must be in the header' >&2
    exit 1
fi
grep -q 'id="top-action"' "$PAGE"
grep -q 'id="i-gear"' "$PAGE"
grep -q 'id="i-plus"' "$PAGE"
grep -q 'id="i-more-vertical"' "$PAGE"
grep -Fq 'const headerIcon={capture:"i-gear",history:"i-more-vertical",reminders:"i-plus",categories:"i-plus"}[page]' "$PAGE"
if grep -Fq '$("top-action").textContent=' "$PAGE"; then
    echo 'Top action must retain SVG icons, not Unicode glyphs' >&2
    exit 1
fi
grep -Fq 'page==="categories"?"Crear categoría"' "$PAGE"
grep -Fq 'if(page==="categories")openCategoryEditor()' "$PAGE"

grep -q 'id="cat-name"' "$PAGE"
grep -q 'id="cat-keywords"' "$PAGE"
grep -q 'id="cat-icon-grid"' "$PAGE"
grep -q 'id="cat-image"' "$PAGE"
grep -q 'id="cat-save"' "$PAGE"
grep -q 'id="li-cigarette"' "$PAGE"
grep -q 'id="li-toilet"' "$PAGE"
grep -q 'const categoryStore =' "$PAGE"
grep -q 'function saveCategoryEditor()' "$PAGE"
grep -q 'function deleteCategory(name,count)' "$PAGE"
grep -q 'onShowFileChooser' "$ROOT/native/AppWebChromeClient.java.in"
grep -q 'params.getAcceptTypes()' "$ROOT/native/AppWebChromeClient.java.in"
grep -q 'Intent.ACTION_OPEN_DOCUMENT' "$ROOT/native/AppWebChromeClient.java.in"
grep -q 'imagesOnly ? "image/\\*" : "\\*/\\*"' "$ROOT/native/AppWebChromeClient.java.in"
grep -q 'Elegir respaldo ZIP' "$ROOT/native/AppWebChromeClient.java.in"
grep -q 'onActivityResult(requestCode, resultCode, data)' "$ROOT/scripts/patch-kcapk.py"
grep -q 'function matchesCategorySearch(category,query)' "$PAGE"
grep -q 'id="entry-dialog"' "$PAGE"
grep -Fq 'r.continuous = true;' "$PAGE"
grep -Fq 'session.restartTimer = setTimeout(run, 350);' "$PAGE"
grep -Fq 'function stopVoice()' "$PAGE"
grep -Fq 'if(voiceSession || voicePending)stopVoice();' "$PAGE"
grep -Fq 'let voiceRequestId = 0;' "$PAGE"
grep -Fq 'requestId!==voiceRequestId' "$PAGE"
grep -Fq '"visibilitychange"' "$PAGE"
grep -Fq '"pagehide"' "$PAGE"
grep -Fq '"cancel",stopVoice' "$PAGE"
grep -Fq 'session.committed = [session.committed,finalized]' "$PAGE"

# Modals must never expand the phone viewport, including with keyboard open.
grep -Fq 'max-width:calc(100vw - 24px)' "$ROOT/web/style.css"
grep -Fq 'max-height:calc(100svh - 24px)' "$ROOT/web/style.css"
grep -Fq 'overscroll-behavior:contain' "$ROOT/web/style.css"
grep -Fq 'dialog input,dialog textarea,dialog select' "$ROOT/web/style.css"

grep -q 'id="reduced-motion" type="checkbox" role="switch" checked' "$PAGE"
grep -q 'class="sensory-switch-track"' "$PAGE"
grep -q 'const reducedMotionKey="registro-habitos-reduced-motion"' "$PAGE"
grep -q 'reducedMotionInput.onchange' "$PAGE"
grep -Fq '.sensory-preferences .sensory-setting input:checked + .sensory-switch-track' "$ROOT/web/style.css"
grep -Fq '.sensory-preferences .sensory-setting input[type=checkbox]' "$ROOT/web/style.css"
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
grep -q 'class="edit-modal-footer"' "$PAGE"
grep -q 'id="edit-save" class="main-button">Guardar</button>' "$PAGE"
grep -q 'id="edit-delete" class="edit-delete-action"' "$PAGE"
for prefix in entry edit; do
    grep -q "id=\"$prefix-moods\"" "$PAGE"
    grep -q "id=\"$prefix-energy-enabled\" type=\"checkbox\" role=\"switch\"" "$PAGE"
    grep -q "id=\"$prefix-energy-value\"" "$PAGE"
    grep -q "id=\"$prefix-energy\" type=\"range\"" "$PAGE"
done
grep -q 'function renderEnergy(prefix)' "$PAGE"
grep -q 'function setMood(prefix,value)' "$PAGE"
grep -q 'mood:readMood("entry")' "$PAGE"
grep -q 'mood:readMood("edit")' "$PAGE"
if grep -q 'id="entry-mood"\|id="energy-enabled"\|id="energy-number"' "$PAGE"; then
    echo 'Old mood or energy controls remain' >&2
    exit 1
fi
if grep -q 'Guardar cambios' "$PAGE"; then
    echo "Edit action must be labeled Guardar" >&2
    exit 1
fi
grep -Fq 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' "$ROOT/web/style.css"
grep -Fq '#edit-dialog .edit-modal-actions>button' "$ROOT/web/style.css"

grep -q 'id="reminder-confirm"' "$PAGE"
grep -q 'class="reminder-dialog-footer"' "$PAGE"
grep -q 'class="reminder-dialog-actions"' "$PAGE"
grep -q 'id="reminder-cancel" type="button" class="secondary">Cancelar' "$PAGE"
grep -q 'id="reminder-confirm" type="button" class="main-button">Guardar' "$PAGE"
grep -q 'id="reminder-delete" type="button" class="reminder-delete-action hidden"' "$PAGE"
grep -Fq '$("reminder-confirm").textContent="Guardar";' "$PAGE"
grep -Fq 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' "$ROOT/web/style.css"
grep -Fq '#reminder-dialog .reminder-dialog-actions>button' "$ROOT/web/style.css"
if grep -q 'id="reminder-confirm"[^>]*>Guardar cambios' "$PAGE"; then
    echo 'Reminder save button must be labeled Guardar' >&2
    exit 1
fi
grep -q 'id="app-action-dialog"' "$PAGE"
grep -q 'id="preview-sound"' "$PAGE"
grep -q 'class="reminder-sound-controls"' "$PAGE"
if grep -q 'id="test-notification"' "$PAGE"; then echo "Old system notification test remains" >&2; exit 1; fi
if grep -q 'id="test-closed-notification"' "$PAGE"; then
 echo "Removed closed-app diagnostic remains" >&2
 exit 1
fi
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
grep -q 'id="reminder-times"' "$PAGE"
grep -q 'id="reminder-add-time"' "$PAGE"
grep -q 'function addReminderTimeRow(value="")' "$PAGE"
grep -q 'function reminderFormTimes()' "$PAGE"
if grep -q 'id="reminder-time"' "$PAGE"; then
 echo 'Old single time control remains' >&2
 exit 1
fi
grep -q 'async update(id,changes)' "$PAGE"
grep -q 'function openReminderDialog(item=null)' "$PAGE"
grep -q 'open.onclick=()=>openReminderDialog(item)' "$PAGE"
grep -q 'row.onclick=()=>openEdit(e)' "$PAGE"
grep -q 'open.onclick=()=>openCategoryEditor(cat)' "$PAGE"
grep -q 'id="edit-dialog"' "$PAGE"
grep -q 'id="edit-close"' "$PAGE"
grep -q 'id="edit-cancel"' "$PAGE"
grep -q 'function handleDeviceBack()' "$PAGE"
grep -q 'window.registroHabitosBack=handleDeviceBack' "$PAGE"
grep -q 'new AppNavigationBridge(this, webView)' "$ROOT/scripts/patch-kcapk.py"
grep -q 'webView.evaluateJavascript(' "$ROOT/scripts/patch-kcapk.py"
grep -q 'window.registroHabitosBack' "$ROOT/scripts/patch-kcapk.py"
grep -q 'public void exitApp()' "$ROOT/native/AppNavigationBridge.java.in"
grep -q '"/app.html".equals(uri.getPath())' "$ROOT/native/AppNavigationBridge.java.in"
if grep -q '<section id="edit"' "$PAGE"; then
    echo "Edit should be an app dialog, not a separate screen" >&2
    exit 1
fi
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
grep -q 'id="export-csv"' "$PAGE"
grep -q 'id="backup-save"' "$PAGE"
grep -q 'id="backup" class="screen"' "$PAGE"
grep -q 'id="analysis" class="screen"' "$PAGE"
grep -q 'data-page="backup"' "$PAGE"
grep -q 'data-page="analysis"' "$PAGE"
grep -q 'id="analysis-status"' "$PAGE"
grep -q 'id="analysis-from" type="date"' "$PAGE"
grep -q 'id="analysis-filter-enabled" type="checkbox" role="switch"' "$PAGE"
grep -q 'id="analysis-date-fields" class="analysis-date-fields" hidden' "$PAGE"
grep -Fq 'if(!$("analysis-filter-enabled").checked)return entries;' "$PAGE"
grep -Fq 'function updateAnalysisDateFilter()' "$PAGE"
grep -q 'id="analysis-to" type="date"' "$PAGE"
grep -q 'function filteredAnalysisEntries()' "$PAGE"
grep -Fq 'csv(selectedEntries)' "$PAGE"
if grep -q 'data-page="data"' "$PAGE"; then
    echo "Old combined menu remains" >&2
    exit 1
fi
grep -Fq 'async function backupFileText(file)' "$PAGE"
grep -q 'deflate-raw' "$PAGE"
grep -q 'MAX_BACKUP_JSON_BYTES' "$PAGE"
grep -Fq 'cat "$ROOT/web/backup-zip.js"' "$ROOT/build.sh"
grep -Fq 'registro-habitos-respaldo.zip' "$PAGE"
grep -Fq 'JSON.stringify(completeBackup())' "$PAGE"
grep -q 'java.util.zip.ZipOutputStream' "$ROOT/native/AppDocumentBridge.java.in"
grep -q 'application/zip' "$ROOT/native/AppDocumentBridge.java.in"
grep -q 'accept=".zip,application/zip,application/x-zip-compressed"' "$PAGE"
grep -q 'Elegir respaldo ZIP' "$ROOT/native/AppWebChromeClient.java.in"
grep -Fq 'zipOnly ? "application/zip"' "$ROOT/native/AppWebChromeClient.java.in"
grep -Fq 'Seleccioná un respaldo ZIP.' "$PAGE"
grep -q 'id="document-status"' "$PAGE"
grep -q 'function completeBackup()' "$PAGE"
grep -q 'function analysisExport()' "$PAGE"
grep -q 'window.registroDocumentResult=' "$PAGE"
grep -q 'ACTION_CREATE_DOCUMENT' "$ROOT/native/AppDocumentBridge.java.in"
grep -q 'new AppDocumentBridge(this, webView)' "$ROOT/scripts/patch-kcapk.py"
grep -q 'AppDocumentBridge.java.in' "$ROOT/build.sh"
grep -q 'id="import-json"' "$PAGE"
grep -q 'id="reminder-list"' "$PAGE"
# Recordatorios use an accessible switch, not the oversized round icon buttons.
grep -Fq 'const switchLabel=el("label","reminder-switch");' "$PAGE"
grep -Fq 'toggle.type="checkbox";toggle.setAttribute("role","switch");' "$PAGE"
grep -Fq 'toggle.checked=item.enabled!==false;' "$PAGE"
grep -Fq 'toggle.onchange=async()=>{' "$PAGE"
grep -Fq 'const track=el("span","sensory-switch-track");' "$PAGE"
grep -Fq '.reminder-item .reminder-switch input:checked + .sensory-switch-track' "$ROOT/web/style.css"
if grep -Fq '.reminder-item button.on{' "$ROOT/web/style.css"; then
    echo 'Legacy circular reminder toggle CSS remains' >&2
    exit 1
fi
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
const matching=new Function("categoryStore",searchHelpers+"; return matchesCategorySearch")({get:name=>({keywords:{
 "Tabaco":["fumar","fume","cigarrillo"],"Vapeo":["vapear","vaper"],
 "Ir al baño":["pis"],"Cafeína":["cafe"],"Alcohol":["cerveza"],"Actividad física":["caminar"]
 }[name]||[]})});
const examplesSearch=[
 ["fum","Tabaco",true],["cigarrillo","Tabaco",true],
 ["vap","Vapeo",true],["pis","Ir al baño",true],
 ["cafe","Cafeína",true],["FÍSICA","Actividad física",true],
 ["fum","Vapeo",false],["cerveza","Tabaco",false]
];
for(const [query,category,expected] of examplesSearch){
 if(matching(category,query)!==expected)throw Error("Category filter failed: "+query+" / "+category);
}
// Hardware Back: modal first, home second, exit confirmation only at home.
const backSource=source.slice(source.indexOf("// Android back is always consumed here:"),
 source.indexOf('document.querySelectorAll("[data-page]")'));
if(!backSource.includes("function handleDeviceBack()"))throw Error("Missing Back handler");
let activePage="history",activeDialogs=[],lastConfirm=null,closeEntryCalls=0;
const systemDialog={open:false,dispatchEvent(){this.open=false;}};
const fakeDoc={
 querySelector(sel){if(sel===".screen.active")return {id:activePage};throw Error("Unknown selector "+sel)},
 querySelectorAll(sel){if(sel==="dialog[open]")return activeDialogs.filter(d=>d.open);throw Error("Unknown selector "+sel)}
};
const windowFake={AppNavigation:{exitApp(){throw Error("Exit must require confirmation")}}};
const back=new Function("$","document","window","show","showAppDialog","closeEntryDialog","Event",
 backSource+";return handleDeviceBack")(
 id=>id==="app-action-dialog"?systemDialog:null,fakeDoc,windowFake,
 page=>{activePage=page},
 options=>{lastConfirm=options;return new Promise(()=>{})},
 ()=>{closeEntryCalls++},class FakeEvent {constructor(type,opts){this.type=type;this.cancelable=opts?.cancelable;}}
);
if(back()!==true||activePage!=="capture"||lastConfirm!==null)
 throw Error("Back from secondary screen must go home");
for(const settingsPage of ["categories","summary","backup","analysis","about"]){
 activePage=settingsPage;lastConfirm=null;
 if(back()!==true||activePage!=="more"||lastConfirm!==null)
  throw Error("Back from "+settingsPage+" must return to Más");
}
if(back()!==true||activePage!=="capture"||lastConfirm!==null)
 throw Error("Back from Más must return to Mi día");

const editDialog={id:"edit-dialog",open:true,close(){this.open=false}};
activeDialogs=[editDialog];
if(!back()||editDialog.open||lastConfirm!==null)throw Error("Back must close edit modal first");
const entryDialog={id:"entry-dialog",open:true};
activeDialogs=[entryDialog];
if(!back()||closeEntryCalls!==1)throw Error("Back must cancel new-entry modal");
activeDialogs=[];
if(!back()||lastConfirm?.title!=="Salir de la app"||lastConfirm?.ok!=="Salir")
 throw Error("Back at home must show a themed exit confirmation");
systemDialog.open=true;
if(!back()||systemDialog.open)throw Error("Back must cancel exit confirmation");
// Profiles must survive local storage, allow renaming, archiving and imports.
const categorySource=fs.readFileSync(root+"/web/categories.js","utf8")
  .replace(/^export const /gm,"const ");
const profileStore=new Map();
const local={getItem:key=>profileStore.get(key)||null,setItem:(key,value)=>profileStore.set(key,value)};
const preset=[["Tabaco","♨","orange"],["Vapeo","≈","purple"]];
const categoryAliases={"Tabaco":["fumar","fume"]};
const categories=new Function("localStorage","preset","categoryAliases",
 categorySource+";return {categoryStore,ICON_NAMES}")(local,preset,categoryAliases);
let profile=categories.categoryStore.get("Tabaco");
if(profile.icon!=="cigarette"||profile.color!=="orange")throw Error("Lucide default invalid");
categories.categoryStore.save({name:"Tabaco",keywords:["fum","pucho"],icon:"cigarette",color:"blue"},"Tabaco");
if(!categories.categoryStore.get("Tabaco").keywords.includes("fum"))throw Error("Edited keywords not saved");
categories.categoryStore.save({name:"Cigarrillos",keywords:["fum"],icon:"cigarette",color:"blue"},"Tabaco");
if(categories.categoryStore.names().includes("Tabaco")||!categories.categoryStore.names().includes("Cigarrillos"))
 throw Error("Renaming a category did not archive previous label");
categories.categoryStore.remove("Cigarrillos");
if(categories.categoryStore.names().includes("Cigarrillos"))throw Error("Removed category still selectable");
categories.categoryStore.merge({"Mate":{"keywords":["cebando"],"icon":"coffee","color":"green"}});
if(!categories.categoryStore.get("Mate").keywords.includes("cebando"))throw Error("Category profile import failed");
const sourceClassifier=fs.readFileSync(root+"/web/classifier.js","utf8").replace("export function suggestCategory","function suggestCategory");
const guess=new Function(sourceClassifier+";return suggestCategory")();
if(guess("Estuve cebando mate",[],null,[categories.categoryStore.get("Mate")])?.category!=="Mate")
 throw Error("Custom keyword does not drive automatic categorization");
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
 throw Error("No closed-app alarm test is available");
// Multi-time reminders reserve a distinct Android alarm ID for every hour.
(async()=>{
const moreCalls=[],moreMem=new Map();
const multiStore=new Function("window","localStorage",remindersSource+";return reminderStore")(
 {NativeBridge:{Android:{
  alarms:{canScheduleExact(){return true},cancel(id){moreCalls.push(["cancel",id]);return true},
   schedule(options){moreCalls.push(["schedule",options]);return true}},
  notifications:{canPost(){return true},createChannel(){return true},post(){return true}},
  permissions:{request:async()=>true}
 }}},
 {getItem:k=>moreMem.get(k)||null,setItem:(k,value)=>moreMem.set(k,value)}
);
let repeated=false;try{multiStore.normalizeTimes(["09:00","09:00"])}catch{repeated=true}
if(!repeated)throw Error("Duplicate reminder hours should be rejected");
const multi=await multiStore.add("Agua",["18:00","09:00","13:00"],true,"daily","glock");
const multiAlarms=moreCalls.filter(([op])=>op==="schedule").map(([,o])=>o);
if(multiAlarms.length!==3||multi.times.join(",")!=="09:00,13:00,18:00"||
 multiAlarms.some((alarm,i)=>alarm.id!==multi.base+i||alarm.action.id!==alarm.id||
  alarm.recurrence?.mode!=="daily"))
 throw Error("Multiple native reminder hours not scheduled independently");
moreCalls.length=0;
await multiStore.update(multi.id,{title:"Agua",times:["10:00","20:00"],repeat:"weekdays",sound:"glock"});
if(moreCalls.filter(([op])=>op==="cancel").length!==29||
 moreCalls.filter(([op])=>op==="schedule").length!==2||
 moreCalls.filter(([op])=>op==="schedule").some(([,o])=>o.recurrence?.mode!=="weekdays"))
 throw Error("Editing hours left stale alarms or lost weekday recurrence");
moreCalls.length=0;await multiStore.setEnabled(multi.id,false);
if(moreCalls.filter(([op])=>op==="cancel").length!==29)throw Error("Disabled multi-time reminder still active");
moreCalls.length=0;await multiStore.setEnabled(multi.id,true);
if(moreCalls.filter(([op])=>op==="schedule").length!==2)throw Error("Enabling must program every hour");
moreCalls.length=0;multiStore.remove(multi.id);
if(moreCalls.filter(([op])=>op==="cancel").length!==29)throw Error("Deleting must cancel all hours");
const onceMulti=await multiStore.add("Descanso",["09:00","21:00"],false,"once","alert");
if(!onceMulti.onceAts?.["09:00"]||!onceMulti.onceAts?.["21:00"])
 throw Error("One-time reminder must retain the dates of every slot");
const past=Date.now()-60000,future=Date.now()+600000;
multiStore.persist([{...onceMulti,onceAts:{"09:00":past,"21:00":future}}]);
moreCalls.length=0;multiStore.refresh();
const futureOnly=moreCalls.filter(([op])=>op==="schedule").map(([,o])=>o);
if(futureOnly.length!==1||futureOnly[0].id!==onceMulti.base+1)
 throw Error("A fired one-time slot was scheduled again");
multiStore.persist([{...onceMulti,onceAts:{"09:00":past,"21:00":past}}]);
moreCalls.length=0;multiStore.refresh();
if(multiStore.list()[0].enabled!==false||moreCalls.some(([op])=>op==="schedule"))
 throw Error("A completed one-time reminder was rescheduled");
multiStore.persist([{id:"200000",base:200000,title:"Anterior",time:"12:00",repeat:"daily",sound:"glock",enabled:true}]);
moreCalls.length=0;multiStore.refresh();
if(multiStore.list()[0].times?.[0]!=="12:00"||
 moreCalls.filter(([op])=>op==="schedule").length!==1)
 throw Error("Legacy single-time reminder was not migrated safely");
})().catch(error=>{console.error(error);process.exitCode=1;});

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

if grep -q 'id="preview-volume"' "$PAGE"; then echo "Preview volume slider remains" >&2; exit 1; fi
grep -Fq 'window.AppSoundPreview.play(name)' "$PAGE"
grep -Fq 'AppSoundPreview.java.in' "$ROOT/build.sh"
grep -Fq 'AudioAttributes.USAGE_NOTIFICATION' "$ROOT/native/AppSoundPreview.java.in"

grep -Fq '#reminder-dialog #reminder-repeat{padding-right:40px!important}' "$ROOT/web/style.css"

# Light mode must override the home search's ID-specific dark background.
grep -Fq 'html.theme-light #category-search,' "$ROOT/web/style.css"
grep -Fq 'html.theme-light #capture-text,' "$ROOT/web/style.css"
grep -Fq 'html.theme-light .entry-dialog,' "$ROOT/web/style.css"
grep -Fq 'html.theme-light .quick-category,' "$ROOT/web/style.css"
grep -Fq 'html.theme-light .add-entry-fab,' "$ROOT/web/style.css"

# Localized UI and locale selection are bundled without external libraries.
grep -Fq 'cat "$ROOT/web/i18n.js"' "$ROOT/build.sh"
grep -q 'id="app-language"' "$PAGE"
grep -q 'function systemAppLanguage()' "$PAGE"
grep -q 'function applyAppLanguage()' "$PAGE"
grep -q 'language:languagePreference()' "$PAGE"

grep -Fq 'Escuchando… puedes hacer pausas.' "$PAGE"
grep -Fq '.item-main strong' "$PAGE"

# Translation must not rewrite unchanged text nodes in a mutation loop.
grep -Fq 'if(next!==node.nodeValue)node.nodeValue=next;' "$ROOT/web/i18n.js"
grep -Fq 'if(next!==value)node.setAttribute(attr,next);' "$ROOT/web/i18n.js"

# Main wrapper and outer canvas must have the same dark background.
grep -Fq '.app{min-height:100dvh;max-width:560px;margin:auto;background:#0b1419;' "$ROOT/web/style.css"
if grep -Fq 'background:linear-gradient(135deg,#0d171d,#091317 65%)' "$ROOT/web/style.css"; then echo "Wrapper gradient still present" >&2; exit 1; fi
