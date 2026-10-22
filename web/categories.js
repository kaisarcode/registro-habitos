// Category profiles are kept locally and included in JSON backups.
// Historical category strings remain valid; deleting a profile only hides the
// shortcut, never deletes an activity entry.
export const ICON_NAMES=["footprints","utensils","heart-handshake","heart-pulse","moon","cloud","brain","book-open","briefcase-business","user-round","droplets","coffee","armchair","users-round","shower-head","toilet","cigarette","wind","wine","pill","activity","camera","image","leaf"];
const CATEGORY_PROFILES_KEY="rh-category-profiles-v1";
const CATEGORY_OLD_KEY="rh-categories";
const DEFAULT_ICONS={
 "Actividad física":"footprints","Alimentación":"utensils","Terapia":"heart-handshake",
 "Salud":"heart-pulse","Sueño":"moon","Emociones":"cloud","Cognitivo":"brain",
 "Ocio":"book-open","Trabajo":"briefcase-business","Personal":"user-round",
 "Hidratación":"droplets","Descanso":"armchair","Salida":"footprints",
 "Social":"users-round","Higiene":"shower-head","Ir al baño":"toilet",
 "Tabaco":"cigarette","Vapeo":"wind","Alcohol":"wine","Medicación":"pill","Cafeína":"coffee"
};
function profileName(name){return String(name||"").trim().replace(/\s+/g," ");}
function profileWords(value){
 const words=Array.isArray(value)?value:String(value||"").split(/[,\n;]/);
 return [...new Set(words.map(x=>String(x).trim()).filter(x=>x.length>0&&x.length<=60))].slice(0,30);
}
export const categoryStore={
 raw(){
  try{
   const data=JSON.parse(localStorage.getItem(CATEGORY_PROFILES_KEY)||"{}");
   return data&&typeof data==="object"&&!Array.isArray(data)?data:{};
  }catch{return {}}
 },
 write(values){localStorage.setItem(CATEGORY_PROFILES_KEY,JSON.stringify(values))},
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
   keywords:profileWords(keywords),deleted:saved.deleted===true,builtin:!!original
  };
 },
 list(){
  return this.names().map(name=>this.get(name));
 },
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
   keywords:profileWords(profile.keywords),deleted:false
  };
  if(saved.image?.length>240000)throw Error("La imagen es demasiado grande.");
  if(former&&former!==name)old[former]={...this.get(former),deleted:true};
  old[name]=saved;
  this.write(old);
  return {name,oldName:former&&former!==name?former:null};
 },
 remove(name){
  const key=profileName(name);
  if(!this.names().includes(key))throw Error("No existe la categoría.");
  this.write({...this.raw(),[key]:{...this.get(key),deleted:true}});
 },
 export(){return this.raw()},
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
    keywords:profileWords(profile.keywords),image,deleted:profile.deleted===true
   };
  }
  this.write(saved);
 }
};
