import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// ZIP "store" format, no system zip executable or extra runtime dependency.
const FILES=['manifest.json','background.js','bridge.js','policy.js','popup.html','popup.js','README.md'];
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../extension');
function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc^=byte;
    for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
export function zipStoredFiles(entries){
  if(!Array.isArray(entries)||!entries.length||entries.length>20)throw Error('Invalid extension file list');
  const seen=new Set(),body=[],central=[];
  let offset=0;
  for(const [name,raw] of entries){
    if(typeof name!=='string'||!/^[A-Za-z0-9_.-]+$/.test(name)||seen.has(name))throw Error('Unsafe archive filename');
    seen.add(name);
    const filename=Buffer.from(name,'utf8');
    const contents=Buffer.isBuffer(raw)?raw:Buffer.from(raw);
    if(contents.length>256_000)throw Error('Extension file too large');
    const crc=crc32(contents);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4); // ZIP version
    local.writeUInt16LE(0,6);
    local.writeUInt16LE(0,8);  // no compression
    local.writeUInt16LE(0,10);
    local.writeUInt16LE(33,12); // 1980-01-01
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(contents.length,18);
    local.writeUInt32LE(contents.length,22);
    local.writeUInt16LE(filename.length,26);
    local.writeUInt16LE(0,28);
    body.push(local,filename,contents);
    const header=Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50,0);
    header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);
    header.writeUInt16LE(0,8);header.writeUInt16LE(0,10);
    header.writeUInt16LE(0,12);header.writeUInt16LE(33,14);
    header.writeUInt32LE(crc,16);
    header.writeUInt32LE(contents.length,20);
    header.writeUInt32LE(contents.length,24);
    header.writeUInt16LE(filename.length,28);
    header.writeUInt16LE(0,30);header.writeUInt16LE(0,32);
    header.writeUInt16LE(0,34);header.writeUInt16LE(0,36);
    header.writeUInt32LE(0,38);
    header.writeUInt32LE(offset,42);
    central.push(header,filename);
    offset+=local.length+filename.length+contents.length;
  }
  const directory=Buffer.concat(central);
  const footer=Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50,0);
  footer.writeUInt16LE(0,4);footer.writeUInt16LE(0,6);
  footer.writeUInt16LE(entries.length,8);footer.writeUInt16LE(entries.length,10);
  footer.writeUInt32LE(directory.length,12);
  footer.writeUInt32LE(offset,16);
  footer.writeUInt16LE(0,20);
  return Buffer.concat([...body,directory,footer]);
}
export async function makeEdgeExtensionZip(){
  const entries=await Promise.all(FILES.map(async name=>[name,await fs.readFile(path.join(ROOT,name))]));
  return zipStoredFiles(entries);
}
