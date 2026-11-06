const $settings = id => document.getElementById(id);
function updateAIFields(){
  const local=$settings('aiProvider').value==='embedded';
  $settings('localFields').style.display=local?'block':'none';
  $settings('apiFields').style.display=local?'none':'block';
}
async function settingsJson(url,options){
  const response=await fetch(url,options);
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||'Settings request failed');
  return body;
}
async function updateHardwareDetails(){
  const info=$settings('builtInInfo');
  info.textContent='Checking this computer…';
  try{
    const state=await settingsJson('/api/built-in/status');
    const hardware=state.hardware||{};
    if(!hardware.enoughMemory){
      info.textContent='This computer has '+hardware.totalMemoryGiB+' GB RAM. Built-in AI may not run: '+hardware.note+' You can still use the optional API mode.';
      return;
    }
    const model=hardware.recommendedModel==='lite'?'Lite AI model':'Standard AI model';
    const readiness=state.phase==='ready'?' · AI ready':state.phase==='loading'?' · Loading AI…':state.error?' · '+state.error:' · AI starts automatically when needed';
    info.textContent='Your computer: '+hardware.totalMemoryGiB+' GB RAM ('+hardware.availableMemoryGiB+' GB available). Work-Mode will use the included '+model+readiness+'.';
  }catch(err){
    info.textContent='Could not read computer information. Built-in AI will be checked when you run a task.';
  }
}
async function openSettings(){
  try{
    const settings=await settingsJson('/api/settings');
    $settings('aiProvider').value=settings.provider==='openai'?'openai':'embedded';
    $settings('apiModel').value=settings.openaiModel||'gpt-4.1-mini';
    $settings('apiKey').value='';
    $settings('keyNote').textContent=settings.hasApiKey?
      'An API key is already saved on this computer. Leave the field blank to keep it.':
      'No API key saved. This is optional when using built-in AI.';
    $settings('settingsMessage').textContent='';
    updateAIFields();
    $settings('settingsDialog').showModal();
    await updateHardwareDetails();
  }catch(err){
    if(typeof entry==='function')entry({message:'AI settings error: '+err.message});
  }
}
$settings('settingsButton').addEventListener('click',()=>void openSettings());
$settings('settingsClose').addEventListener('click',()=>$settings('settingsDialog').close());
$settings('aiProvider').addEventListener('change',updateAIFields);
$settings('settingsForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const message=$settings('settingsMessage');
  message.textContent='Saving…';
  const data={
    provider:$settings('aiProvider').value,
    openaiModel:$settings('apiModel').value.trim()
  };
  const key=$settings('apiKey').value.trim();
  if(key)data.apiKey=key;
  try{
    const saved=await settingsJson('/api/settings',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data)
    });
    if(saved.provider==='openai'&&!saved.hasApiKey){
      message.textContent='To use paid API mode, enter an API key. Choose Built-in AI for an option that does not require a key.';
      return;
    }
    message.textContent='Saved.';
    $settings('apiKey').value='';
    $settings('settingsDialog').close();
    if(typeof entry==='function')entry({message:'AI mode selected: '+(saved.provider==='embedded'?'Built-in AI':'OpenAI API')});
  }catch(err){message.textContent=err.message;}
});
