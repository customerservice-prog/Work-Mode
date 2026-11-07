import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_TASKS=80;
const ALLOWED=new Set(['phase','steps','answer','lastAction','finishedAt']);
export function createTaskJournal({directory,secret,now=()=>new Date()}) {
  if (!path.isAbsolute(directory)) throw Error('Task journal requires an absolute directory');
  if (String(secret||'').length<32) throw Error('Task journal requires a strong secret');
  const key=crypto.scryptSync(String(secret),'workmode-task-journal-v1',32);
  const filepath=path.join(directory,'task-checkpoints.enc');
  let queue=Promise.resolve();
  async function read() {
    let payload;
    try { payload=await fs.readFile(filepath,'utf8'); }
    catch (err) { if (err.code==='ENOENT') return []; throw err; }
    try {
      const box=JSON.parse(payload);
      if (box.version!==1) throw Error('Unsupported journal version');
      const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
      decipher.setAuthTag(Buffer.from(box.tag,'base64'));
      const plain=Buffer.concat([decipher.update(Buffer.from(box.data,'base64')),decipher.final()]);
      const records=JSON.parse(plain.toString('utf8'));
      if (!Array.isArray(records)) throw Error('Not an array');
      return records;
    } catch { throw Error('Encrypted task journal is unreadable; refusing to discard or overwrite it'); }
  }
  async function write(records) {
    await fs.mkdir(directory,{recursive:true,mode:0o700});
    const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(records)),cipher.final()]);
    const box={version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
    const temp=filepath+'.'+process.pid+'.tmp';
    await fs.writeFile(temp,JSON.stringify(box),{mode:0o600});
    await fs.rename(temp,filepath);
  }
  function transact(modifier) {
    const job=queue.catch(()=>{}).then(async()=>{
      const records=await read();
      const result=modifier(records);
      if (result.changed) await write(records);
      return result.value;
    });
    queue=job.then(()=>{},()=>{});
    return job;
  }
  const stamp=()=>now().toISOString();
  async function begin(task) {
    return transact(records=>{
      const item={id:crypto.randomUUID(),task:String(task).slice(0,3000),
        phase:'running',steps:0,answer:'',lastAction:'',
        startedAt:stamp(),updatedAt:stamp(),finishedAt:null};
      records.unshift(item);
      records.splice(MAX_TASKS);
      return {changed:true,value:item};
    });
  }
  async function update(id,patch) {
    return transact(records=>{
      const item=records.find(x=>x.id===id);
      if (!item) throw Error('Task journal entry not found');
      for (const [field,value] of Object.entries(patch||{})) {
        if (!ALLOWED.has(field)) throw Error('Unknown journal field');
        item[field]=field==='steps' ? Math.max(0,Number(value)||0) : String(value ?? '').slice(0,3000);
      }
      item.updatedAt=stamp();
      return {changed:true,value:{...item}};
    });
  }
  async function recover() {
    return transact(records=>{
      const interrupted=[];
      for (const item of records) {
        if (['running','awaiting_approval'].includes(item.phase)) {
          item.phase='interrupted';
          item.answer='Task interrupted by a server restart. External actions may have partially completed. Review the website before retrying; no actions were automatically replayed.';
          item.finishedAt=stamp();item.updatedAt=stamp();
          interrupted.push({...item});
        }
      }
      return {changed:interrupted.length>0,value:interrupted};
    });
  }
  async function list() { await queue; return (await read()).map(x=>({...x})); }
  return {begin,update,recover,list,filepath};
}
