const aiEl = id => document.getElementById(id);
let systemInfo = null;
let modelCheckRunning = false;

function readableStatus(s) {
  const hw=s?.hardware||{};
  const lines=[
    'Work-Mode Lite v0.5.0 — offline diagnostics',
    'Platform: '+String(hw.platform||'unknown')+' / '+String(hw.architecture||'unknown'),
    'Installed RAM: '+String(hw.totalMemoryGiB??'?')+' GB',
    'Available RAM: '+String(hw.availableMemoryGiB??'?')+' GB',
    'Built-in model: Qwen3 0.6B Lite',
    'AI state: '+String(s?.phase||'unknown'),
    'AI error: '+String(s?.error||'none'),
    'Ollama required: no',
    'Cloud account required: no',
    'Paid API required: no'
  ];
  return lines.join('\n');
}

async function refreshSystemInfo() {
  const info=aiEl('builtInInfo');
  try {
    const response=await fetch('/api/built-in/status',{cache:'no-store'});
    const state=await response.json();
    if(!response.ok)throw Error(state.error||'Could not check the local system');
    systemInfo=state;
    const hw=state.hardware||{};
    const memory=String(hw.totalMemoryGiB??'?')+' GB installed, '+String(hw.availableMemoryGiB??'?')+' GB available';
    if(!hw.enoughMemory){
      info.textContent='Memory: '+memory+'. The offline AI needs more RAM, but basic website-opening commands can still work without loading the model.';
    }else{
      const status=state.error ? ' Last problem: '+state.error
        : state.ready ? ' AI model is ready.'
        : ' AI starts only when you request it.';
      info.textContent='Memory: '+memory+'. Qwen3 Lite is included.'+status;
    }
  }catch(err){
    info.textContent='Could not check RAM or model status: '+err.message;
    systemInfo={phase:'error',error:String(err.message||err)};
  }
  return systemInfo;
}

aiEl('settingsButton').textContent='System check';
aiEl('settingsButton').addEventListener('click',()=>{
  aiEl('diagnosticsMessage').textContent='';
  aiEl('settingsDialog').showModal();
  void refreshSystemInfo();
});
aiEl('settingsClose').addEventListener('click',()=>aiEl('settingsDialog').close());

aiEl('testOfflineAI').addEventListener('click',async()=>{
  if(modelCheckRunning)return;
  modelCheckRunning=true;
  const button=aiEl('testOfflineAI');
  const msg=aiEl('diagnosticsMessage');
  button.disabled=true;
  button.textContent='Testing…';
  msg.textContent='Starting the included offline model and asking it to respond. This may take a while on an older computer.';
  try{
    const response=await fetch('/api/built-in/check',{method:'POST',cache:'no-store'});
    const result=await response.json().catch(()=>({}));
    systemInfo=result.status||systemInfo;
    if(!response.ok||!result.ok)throw Error(result.error||'Offline AI did not pass the test');
    msg.textContent='Offline AI passed the response test. The model responded: '+String(result.sample||'').slice(0,80)+'. Complex browser tasks still need real verification.';
  }catch(err){
    msg.textContent='Offline AI did not pass: '+err.message+
      ' You can still use simple website-opening commands without the AI model.';
  }finally{
    modelCheckRunning=false;
    button.disabled=false;
    button.textContent='Test offline AI';
    void refreshSystemInfo();
  }
});

aiEl('copyDiagnostics').addEventListener('click',async()=>{
  if(!systemInfo)await refreshSystemInfo();
  const text=readableStatus(systemInfo);
  try{
    await navigator.clipboard.writeText(text);
    aiEl('diagnosticsMessage').textContent='System information copied. You can paste it into this chat for troubleshooting; it contains no account passwords or API keys.';
  }catch{
    const field=document.createElement('textarea');
    field.value=text;
    field.style.position='fixed';
    field.style.opacity='0';
    document.body.appendChild(field);
    field.select();
    const copied=document.execCommand('copy');
    field.remove();
    aiEl('diagnosticsMessage').textContent=copied
      ? 'System information copied. Paste it into the chat for help.'
      : 'Could not copy automatically. Diagnostics: '+text;
  }
});
