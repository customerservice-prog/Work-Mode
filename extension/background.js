importScripts('policy.js');
const POLICY=globalThis.WorkModeTabPolicy;
const SELECTION_KEY='workmodeSelectedTab';

async function selectedTab() {
  const saved=(await chrome.storage.local.get(SELECTION_KEY))[SELECTION_KEY];
  if(!saved || !Number.isInteger(saved.id))return null;
  try {
    const tab=await chrome.tabs.get(saved.id);
    if(!POLICY.supportedUrl(tab.url||'') || new URL(tab.url).origin!==saved.origin) {
      return {connected:false,reason:'The selected tab changed websites. Reconnect it with the extension icon.'};
    }
    const origin=new URL(tab.url).origin+'/*';
    if(!(await chrome.permissions.contains({origins:[origin]}))){
      return {connected:false,reason:'This website is not approved. Open its tab and grant access using the extension icon.'};
    }
    return {connected:true,tab};
  }catch{return {connected:false,reason:'The selected tab was closed. Select a tab again with the extension icon.'};}
}
async function inspectTab(tab,command) {
  const result=await chrome.scripting.executeScript({
    target:{tabId:tab.id,allFrames:false},
    world:'ISOLATED',
    func: (cmd) => {
      const visible=(el)=>{
        if(!el || !el.isConnected)return false;
        const style=getComputedStyle(el);
        const r=el.getBoundingClientRect();
        return style.visibility!=='hidden' && style.display!=='none' && r.width>0 && r.height>0;
      };
      const named=(el)=>{
        const aria=el.getAttribute('aria-label')||'';
        const title=el.getAttribute('title')||'';
        const placeholder=el.getAttribute('placeholder')||'';
        const text=(el.innerText||el.textContent||'').trim();
        return (aria||title||placeholder||text||el.getAttribute('value')||el.getAttribute('name')||'').trim().replace(/\s+/g,' ').slice(0,150);
      };
      const isSensitive=(el)=>/(?:password|passcode|one.?time|otp|verification|2fa|mfa|secret|api.?key|token|credit.?card|cvv|cvc|routing|account.?number|social.?security)/i.test([
        el.getAttribute('aria-label'),el.getAttribute('name'),el.getAttribute('type'),el.getAttribute('placeholder')
      ].filter(Boolean).join(' '));
      const isHigh=(el)=>/(?:\bpost\b|\bpublish\b|\bshare\b|\bsend\b|\bsubmit\b|\bpay\b|\bbuy\b|\border\b|\bdelete\b|\bremove\b|\bconfirm\b|\bapprove\b|\bjoin\b|\binvite\b|\bupload\b|\bsign\s?out\b)/i.test([named(el),el.getAttribute('type')].join(' '));
      const read=()=>{
        const nonce=String(Date.now())+'-'+Math.random().toString(36).slice(2);
        document.documentElement.setAttribute('data-workmode-snapshot',nonce);
        let n=0;
        const controls=[];
        for(const el of document.querySelectorAll('button,[role="button"],a[href],input,textarea,select,[role="textbox"],[contenteditable="true"]')){
          if(!visible(el))continue;
          const id=String(n++);
          el.setAttribute('data-workmode-control',id);
          el.setAttribute('data-workmode-control-snapshot',nonce);
          controls.push({id,label:named(el),tag:el.tagName.toLowerCase(),type:el.getAttribute('type')||'',
            editable:el.matches('input,textarea,select,[role="textbox"],[contenteditable="true"]'),
            sensitive:isSensitive(el),highImpact:isHigh(el)});
          if(controls.length>=140)break;
        }
        return {ok:true,url:location.href,title:document.title,
          text:(document.body?.innerText||'').slice(0,6000),
          controls,snapshot:nonce,limitedFrames:true};
      };
      if(cmd.action==='inspect')return read();
      if(cmd.action==='verify'){
        const kind=String(cmd.kind||'text');
        const target=String(cmd.expected||'').trim().slice(0,200);
        if(!target)throw Error('Provide an exact verification phrase');
        const observed=kind==='title'?document.title:kind==='url'?location.href:(document.body?.innerText||'');
        if(!['text','title','url'].includes(kind))throw Error('Unsupported verification kind');
        return {ok:true,verified:observed.toLowerCase().includes(target.toLowerCase()),kind,expected:target,url:location.href};
      }
      if(cmd.action==='scroll'){
        window.scrollBy({top:cmd.direction==='up'?-560:560,behavior:'instant'});
        return {ok:true,url:location.href};
      }
      if(cmd.action==='click'||cmd.action==='fill'){
        if(cmd.pageUrl!==location.href)throw Error('The page changed. Read it again before interacting.');
        if(cmd.snapshot!==document.documentElement.getAttribute('data-workmode-snapshot'))throw Error('The page snapshot expired; read the page again.');
        const id=String(cmd.id||'');
        if(!/^\d{1,3}$/.test(id))throw Error('Use a numbered control from Read page.');
        const el=document.querySelector('[data-workmode-control="'+id+'"][data-workmode-control-snapshot="'+cmd.snapshot+'"]');
        if(!visible(el))throw Error('The selected control is gone or hidden. Read the page again.');
        if(cmd.expectedLabel && named(el)!==cmd.expectedLabel)throw Error('The control changed. Read the page again.');
        if(cmd.action==='click'){
          if(isHigh(el) && cmd.confirmed!==true)throw Error('This action can publish, submit, or change data. Confirm before clicking.');
          el.click();
          return {ok:true,action:'click',label:named(el),highImpact:isHigh(el),verification:'not verified'};
        }
        if(!el.matches('input,textarea,[role="textbox"],[contenteditable="true"]'))throw Error('The selected control is not a text field.');
        if(isSensitive(el))throw Error('Enter passwords or verification codes directly into the website, not Work-Mode.');
        const value=String(cmd.text||'');
        if(value.length>3000)throw Error('Text exceeds 3000 characters.');
        el.focus();
        if(el.isContentEditable){
          const selection=window.getSelection();
          const range=document.createRange();range.selectNodeContents(el);
          selection.removeAllRanges();selection.addRange(range);
          if(!document.execCommand('insertText',false,value)){
            el.textContent=value;
            el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
          }
        }else{
          const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
          if(setter)setter.call(el,value);else el.value=value;
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        return {ok:true,action:'fill',label:named(el),verification:'not verified'};
      }
      throw Error('Unknown page command');
    },
    args:[command]
  });
  if(!result?.length)throw Error('The extension could not inspect this tab');
  if(result[0].error)throw Error(result[0].error.message||'Site interaction failed');
  return result[0].result;
}
async function handle(action,args={}) {
  if(!POLICY.allowAction(action))throw Error('Unsupported browser action');
  if(action==='status'){
    const selected=await selectedTab();
    return selected?.connected?{installed:true,connected:true,tab:{id:selected.tab.id,url:selected.tab.url,title:selected.tab.title}}:
      {installed:true,connected:false,reason:selected?.reason||'Open the target website tab and click the Work-Mode extension icon to connect it.'};
  }
  if(action==='tabs')return handle('status');
  const selected=await selectedTab();
  if(!selected?.connected)throw Error(selected?.reason||'No browser tab connected');
  const tab=selected.tab;
  if(action==='navigate'){
    const target=String(args.url||'');
    if(!POLICY.supportedUrl(target))throw Error('Only public http(s) pages are supported');
    if(new URL(target).origin!==new URL(tab.url).origin)
      throw Error('Changing websites requires selecting and approving that site from the extension icon.');
    await chrome.tabs.update(tab.id,{url:target});
    return {ok:true,url:target,message:'Navigation requested. Wait for the page and inspect it before acting.'};
  }
  if(action==='back'){
    await chrome.tabs.goBack(tab.id);
    return {ok:true,message:'Went back. Read the page again before acting.'};
  }
  if(action==='screenshot')throw Error('Screenshots of background Edge tabs are unavailable. Select the tab to view it directly.');
  return inspectTab(tab,{action,...args});
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  if(msg?.channel!=='WORKMODE_SITE_REQUEST' || !POLICY.fromWorkMode(sender))return false;
  Promise.resolve().then(()=>handle(msg.action,msg.args||{}))
    .then(result=>respond({ok:true,result}))
    .catch(error=>respond({ok:false,error:String(error?.message||error).slice(0,300)}));
  return true;
});
