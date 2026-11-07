// Only a signed-in page on the configured Work-Mode origin can use this bridge.
// No arbitrary page JavaScript, passwords, or browser cookies are exposed.
const ORIGIN='https://work-mode-production.up.railway.app';
if(location.origin===ORIGIN){
  window.postMessage({channel:'WORKMODE_EXTENSION_READY',installed:true},ORIGIN);
  window.addEventListener('message',event=>{
    if(event.source!==window || event.origin!==ORIGIN)return;
    const msg=event.data;
    if(!msg || msg.channel!=='WORKMODE_PAGE_REQUEST' || typeof msg.id!=='string' ||
       msg.id.length>100 || typeof msg.action!=='string')return;
    chrome.runtime.sendMessage({channel:'WORKMODE_SITE_REQUEST',action:msg.action,args:msg.args||{}},
      response=>{
        const lastError=chrome.runtime.lastError;
        window.postMessage({channel:'WORKMODE_EXTENSION_REPLY',id:msg.id,
          ...(lastError?{ok:false,error:lastError.message}:response||{ok:false,error:'No extension response'})},ORIGIN);
      });
  });
}
