import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {redactForLog} from './safety.js';

const CLOUD_MODE=process.env.WORKMODE_CLOUD_MODE === '1';
const BASE=CLOUD_MODE && process.env.WORKMODE_DATA_DIR
  ? path.resolve(process.env.WORKMODE_DATA_DIR)
  : path.join(os.homedir(),'.work-mode');
const FILE=path.join(BASE,'task-history.json');
const ENCRYPTED_FILE=path.join(BASE,'task-history.enc');
const MAX_HISTORY=60;
const key=CLOUD_MODE && process.env.WORKMODE_SESSION_SECRET
  ? crypto.scryptSync(process.env.WORKMODE_SESSION_SECRET,'workmode-history-v1',32)
  : null;
let writeQueue=Promise.resolve();

async function fromPlaintext() {
  try {
    const value=JSON.parse(await fs.readFile(FILE,'utf8'));
    if (!Array.isArray(value)) throw Error('Task history format is invalid');
    return value;
  } catch(err) {
    if(err.code==='ENOENT')return [];
    throw err;
  }
}
async function readAll() {
  if (!CLOUD_MODE) return fromPlaintext();
  if (!key) throw Error('Cloud task history requires a private storage key');
  let encoded;
  try {encoded=await fs.readFile(ENCRYPTED_FILE,'utf8');}
  catch(err) {
    if(err.code==='ENOENT')return fromPlaintext(); // Migration only.
    throw err;
  }
  try{
    const box=JSON.parse(encoded);
    if(box.version!==1)throw Error('Invalid encrypted history version');
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
    decipher.setAuthTag(Buffer.from(box.tag,'base64'));
    const plain=Buffer.concat([decipher.update(Buffer.from(box.data,'base64')),decipher.final()]);
    const records=JSON.parse(plain.toString('utf8'));
    if(!Array.isArray(records))throw Error('Task history was not an array');
    return records;
  }catch {throw Error('Encrypted task history is unreadable; refusing plaintext fallback');}
}
async function saveAll(records) {
  await fs.mkdir(BASE,{recursive:true,mode:0o700});
  if (!CLOUD_MODE) {
    const staged=FILE+'.tmp';
    await fs.writeFile(staged,JSON.stringify(records,null,2),{encoding:'utf8',mode:0o600});
    await fs.rename(staged,FILE);
    return;
  }
  if(!key)throw Error('Cloud task history requires a private storage key');
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(records)),cipher.final()]);
  const box={version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:body.toString('base64')};
  const staged=ENCRYPTED_FILE+'.'+process.pid+'.tmp';
  await fs.writeFile(staged,JSON.stringify(box),{mode:0o600});
  await fs.rename(staged,ENCRYPTED_FILE);
  await fs.unlink(FILE).catch(err=>{if(err.code!=='ENOENT')throw err;});
}
export async function migrateHistory() {
  if(!CLOUD_MODE)return;
  const readQueue=writeQueue;
  await readQueue;
  let encryptedExists=false;
  try{await fs.access(ENCRYPTED_FILE);encryptedExists=true;}catch{}
  if(encryptedExists){
    await readAll(); // Never replace corrupt encrypted history with old plaintext.
    await fs.unlink(FILE).catch(err=>{if(err.code!=='ENOENT')throw err;});
    return;
  }
  const existing=await fromPlaintext();
  await saveAll(existing.slice(-MAX_HISTORY));
}
export async function listHistory() {
  await writeQueue;
  return (await readAll()).map(({id,task,phase,answer,startedAt,finishedAt,steps})=>
    ({id,task,phase,answer,startedAt,finishedAt,steps})).reverse();
}
export async function recordTask(record) {
  const task={
    id:crypto.randomUUID(),
    task:redactForLog(record.task).slice(0,3000),
    phase:String(record.phase||'unknown'),
    answer:redactForLog(record.answer||'').slice(0,3000),
    startedAt:String(record.startedAt||''),
    finishedAt:new Date().toISOString(),
    steps:Math.max(0,Number(record.steps)||0),
    actions:(record.actions||[]).slice(-40).map(a=>({at:a.at,message:redactForLog(a.message)}))
  };
  const job=writeQueue.catch(()=>{}).then(async()=>{
    const all=await readAll();all.push(task);
    await saveAll(all.slice(-MAX_HISTORY));
  });
  writeQueue=job.then(()=>{},()=>{});
  await job;
  return task.id;
}
export async function historyEntry(id) {
  await writeQueue;
  return (await readAll()).find(entry=>entry.id===id)||null;
}
