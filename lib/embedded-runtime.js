import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PORT = 11436;
const BASE_URL = 'http://127.0.0.1:' + PORT;
const GIB = 1024 ** 3;
const MIN_TOTAL_RAM = 3.5 * GIB;
const MODELS = Object.freeze({
  lite: { name: 'Qwen3 0.6B Lite', filename: 'Qwen3-0.6B-Q4_K_M.gguf', context: 3072, minSize: 350_000_000 }
});
let processHandle = null;
let pendingStart = null;
let runtimeKey = '';
let runtimeAlias = '';
let modelKey = '';
let ready = false;
let error = '';
let phase = 'not-started';
let lastUse = 0;
let stopping = false;

export function selectModel(totalBytes) {
  if (!Number.isFinite(totalBytes) || totalBytes < MIN_TOTAL_RAM) return 'unsupported';
  return 'lite';
}
export function hardwareInfo() {
  const total = os.totalmem(), free = os.freemem();
  const recommended = selectModel(total);
  return {
    platform: process.platform,
    architecture: process.arch,
    totalMemoryGiB: +(total / GIB).toFixed(1),
    availableMemoryGiB: +(free / GIB).toFixed(1),
    recommendedModel: recommended,
    enoughMemory: recommended !== 'unsupported',
    note: recommended === 'unsupported'
      ? 'This computer has under 3.5 GB of RAM. AI is disabled to avoid overloading Windows; basic browser commands can still work.'
      : 'Lite mode uses one included offline model with no API subscription or message quota. Complex website tasks can be inaccurate or slow.'
  };
}
export function runtimeStatus() {
  return { phase, ready, error, model: MODELS[modelKey]?.name || 'Qwen3 0.6B Lite', hardware: hardwareInfo(),
    installedWithApp: true, requiresOllama: false };
}
export function embeddedClientConfig() {
  if (!ready || !processHandle || !runtimeKey) {
    throw new Error(error || 'Built-in AI is not ready. Check AI Settings for details.');
  }
  lastUse = Date.now();
  return {
    baseURL: BASE_URL + '/v1',
    apiKey: runtimeKey,
    timeout: 120000,
    maxRetries: 0,
    model: runtimeAlias
  };
}
async function verifyOwnServer() {
  const response = await fetch(BASE_URL + '/v1/models', {
    headers: { Authorization: 'Bearer ' + runtimeKey },
    signal: AbortSignal.timeout(1800)
  });
  if (!response.ok) return false;
  const responseBody = await response.json();
  return Array.isArray(responseBody.data) && responseBody.data.some(x => x.id === runtimeAlias);
}
export async function startEmbeddedAI(resourceRoot) {
  if (ready && processHandle) return embeddedClientConfig();
  if (pendingStart) return pendingStart;
  stopping = false;
  phase = 'loading';
  error = '';
  pendingStart = (async () => {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw new Error('The built-in AI is packaged for 64-bit Windows only.');
    }
    const info = hardwareInfo();
    if (!info.enoughMemory) throw new Error(info.note);
    if (os.freemem() < 650 * 1024 * 1024) {
      throw new Error('Not enough free memory to start AI. Close browser tabs or other apps, then try the Offline AI test again.');
    }
    modelKey = 'lite';
    const model = MODELS[modelKey];
    const root = path.resolve(resourceRoot);
    const executable = path.join(root, 'engine', 'llama-server.exe');
    const modelPath = path.join(root, 'models', model.filename);
    const [engineInfo, modelInfo] = await Promise.all([fs.stat(executable),fs.stat(modelPath)]);
    if (!engineInfo.isFile() || !modelInfo.isFile() || modelInfo.size < model.minSize) {
      throw new Error('The built-in AI files are missing or incomplete. Reinstall Work-Mode from its verified release.');
    }
    runtimeKey = randomBytes(32).toString('hex');
    runtimeAlias = 'workmode-' + randomBytes(8).toString('hex');
    const args = [
      '--model',modelPath,'--alias',runtimeAlias,'--host','127.0.0.1',
      '--port',String(PORT),'--ctx-size',String(model.context),
      '--parallel','1','--threads',String(Math.max(1,Math.min(2,os.availableParallelism?.()||os.cpus().length))),
      '--n-gpu-layers','0','--jinja','--no-webui','--api-key',runtimeKey
    ];
    const worker = spawn(executable,args,{
      cwd:path.join(root,'engine'),windowsHide:true,stdio:['ignore','ignore','pipe']
    });
    let recentEngineErrors = '';
    worker.stderr?.on('data', chunk => {
      recentEngineErrors = (recentEngineErrors + String(chunk)).slice(-1600);
    });
    processHandle = worker;
    worker.once('error',err=>{
      if(processHandle===worker){
        ready=false;phase='error';error='Built-in AI failed to start: '+err.message;
      }
    });
    worker.once('exit',code=>{
      if(processHandle===worker){
        processHandle=null;ready=false;
        if(!stopping){
          phase='error';
          const memoryRelated = /alloc|memory|out of memory|failed to reserve/i.test(recentEngineErrors);
          error= memoryRelated
            ? 'AI ran out of memory. Close other applications and retry. Basic website navigation still works without AI.'
            : 'The bundled AI engine exited (code '+code+'). Check that Windows is up to date and that antivirus has not blocked the included model.';
        }
      }
    });
    // Startup can be slow on older CPUs. Do not spin in a busy loop.
    for(let i=0;i<180;i++){
      if(stopping) throw new Error('Built-in AI was stopped');
      if(error) throw new Error(error);
      if(worker.exitCode !== null) throw new Error('Built-in AI exited before it became ready.');
      try {
        if(await verifyOwnServer()){
          if(worker.exitCode !== null || worker.killed) throw Error('Engine exited');
          ready=true;phase='ready';lastUse=Date.now();
          return embeddedClientConfig();
        }
      }catch{}
      await new Promise(resolve=>setTimeout(resolve,650));
    }
    throw new Error('Built-in AI did not load. This PC may need more available memory, or Windows blocked the engine.');
  })().catch(err=>{
    ready=false;phase='error';error=String(err.message||err).slice(0,350);
    try { processHandle?.kill(); } catch {}
    processHandle=null;
    throw err;
  }).finally(()=>{pendingStart=null;});
  return pendingStart;
}
export function markEmbeddedAIUsed() { lastUse=Date.now(); }
export async function stopEmbeddedAI(){
  stopping=true;ready=false;phase='stopped';
  const worker=processHandle;
  processHandle=null;
  runtimeKey='';
  runtimeAlias='';
  if(worker){
    try {worker.kill();}catch{}
  }
}
export function scheduleIdleRelease({idleMs=4*60*1000,isBusy=()=>false}={}){
  const timer=setInterval(()=>{
    if(!ready||!processHandle||pendingStart||isBusy())return;
    if(Date.now()-lastUse>=idleMs)void stopEmbeddedAI();
  },60000);
  timer.unref?.();
  return ()=>clearInterval(timer);
}
