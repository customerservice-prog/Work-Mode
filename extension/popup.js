const policy=globalThis.WorkModeTabPolicy;
const tabEl=document.getElementById('tab'),button=document.getElementById('connect'),
      message=document.getElementById('result');
let current=null;
(async()=>{
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  current=tabs[0]||null;
  if(!current || !policy.supportedUrl(current.url||'')){
    tabEl.textContent='This tab cannot be controlled. Open an ordinary website and try again.';
    return;
  }
  if(new URL(current.url).origin===policy.SITE){
    tabEl.textContent='This is the Work-Mode dashboard. First switch to the Facebook (or other website) tab and click the extension there.';
    return;
  }
  tabEl.textContent=(current.title||'Untitled tab')+' — '+new URL(current.url).origin;
  button.disabled=false;
})().catch(()=>{tabEl.textContent='Could not find the active Edge tab.';});
button.addEventListener('click',async()=>{
  if(!current)return;
  button.disabled=true;
  try{
    const origin=new URL(current.url).origin;
    const permission=await chrome.permissions.request({origins:[origin+'/*']});
    if(!permission)throw Error('Website permission was not granted.');
    const updated=await chrome.tabs.get(current.id);
    if(new URL(updated.url).origin!==origin)throw Error('The page changed while requesting access. Please try again.');
    await chrome.storage.local.set({workmodeSelectedTab:{id:current.id,origin}});
    message.textContent='Connected: '+origin+'. Switch to your Work-Mode tab and choose Check extension.';
    button.textContent='Connected';
  }catch(e){message.textContent=String(e.message||e);button.disabled=false;}
});
