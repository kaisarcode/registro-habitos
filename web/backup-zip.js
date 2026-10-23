// Offline ZIP reader for backups created by Android ZipOutputStream.
// No dependencies or network. Supports regular single-disk ZIP (STORE/DEFLATE).
const MAX_BACKUP_ZIP_BYTES=25*1024*1024;
const MAX_BACKUP_JSON_BYTES=20*1024*1024;
async function backupFileText(file){
 if(file.size>MAX_BACKUP_ZIP_BYTES)throw Error("El respaldo es demasiado grande.");
 const data=await file.arrayBuffer();
 const bytes=new Uint8Array(data);
 if(bytes.length<4||!(bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4)){
  // Older uncompressed .json backups remain supported.
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 }
 const dv=new DataView(data);
 // Locate End of Central Directory in the last 65,557 bytes.
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
