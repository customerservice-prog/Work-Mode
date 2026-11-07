// Opt-in Edge-tab actions use a locally installed extension; no cloud browser API.
(() => {
const el=id=>document.getElementById(id),toggle=el('edgeToggle'),panel=el('edgeConnector');
if(!toggle||!panel)return;
let snapshot=null,active=false,working=false,idCounter=0;
const pending=new Map();
const feedback=message=>{el('edgeFeedback').textContent=String(message||'');};
const status=message=>{el('edgeStatus').textContent=String(message||'');};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  const msg=event.data;
  if(!msg||msg.channel!=='WORKMODE_EXTENSION_REPLY')return;
  const job=pending.get(msg.id);
  if(!job)return;
  clearTimeout(job.timeout);pending.delete(msg.id);
  if(msg.ok)job.resolve(msg.result);
  else job.reject(new Error(msg.error||'Edge extension could not complete the action.'));
});
function request(action,args={}){
  const id='edge-'+(++idCounter)+'-'+Date.now();
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('No Edge extension response. Install the extension, select a website tab and reload Work-Mode.'));},16000);
    pending.set(id,{resolve,reject,timeout});
    window.postMessage({channel:'WORKMODE_PAGE_REQUEST',id,action,args},location.origin);
  });
}
async function check(){
  const data=await request('status');
  status(data.connected?('Connected to: '+data.tab.title+'\n'+data.tab.url+'\nThis tab was explicitly approved in Edge.'):
    (data.reason||'No Edge website tab is connected. Open a website tab and click the Work-Mode extension icon.'));
  return data;
}
function render(page){
  snapshot=page;
  const sel=el('edgeControl');
  sel.replaceChildren();
  const none=document.createElement('option');none.value='';none.textContent='Choose a visible website control';sel.appendChild(none);
  for(const item of page.controls||[]){
    const option=document.createElement('option');
    option.value=item.id;
    option.textContent=(item.label||item.tag||'unnamed control').slice(0,75)+' · '+item.tag+' #'+item.id+(item.highImpact?' · approval needed':'');
    sel.appendChild(option);
  }
  status('Page: '+page.title+'\n'+page.url+'\n'+(page.controls||[]).length+' controls available. Secret fields are protected.');
  feedback('Page text excerpt (not an AI summary):\n'+String(page.text||'').slice(0,1300));
  return page;
}
async function inspect(){return render(await request('inspect'));}
const selected=()=>snapshot?.controls?.find(c=>c.id===el('edgeControl').value)||null;
function argsFor(item,extra={}){
  if(!snapshot||!item)throw Error('Read the website and select a visible control first.');
  return {id:item.id,expectedLabel:item.label,pageUrl:snapshot.url,snapshot:snapshot.snapshot,...extra};
}
async function click(item,forceApproved=false){
  if(!item)throw Error('Select a control first.');
  let approved=forceApproved;
  if(item.highImpact && !forceApproved){
    approved=window.confirm('This may publish, send, join, or submit. Confirm clicking "'+item.label+'" on '+snapshot.url+'?');
    if(!approved)return {ok:false,cancelled:true};
  }
  return request('click',argsFor(item,{confirmed:approved}));
}
async function fill(item,text){
  if(!item||!item.editable||item.sensitive)throw Error('Choose a non-secret editable field; type passwords directly into Edge.');
  return request('fill',argsFor(item,{text:String(text||'')}));
}
async function locked(fn){
  if(working)throw Error('Another Edge action is in progress.');
  working=true;
  try {return await fn();}
  finally {working=false;}
}
function report(promise){
  void promise.catch(err=>feedback(err.message||String(err)));
}
toggle.hidden=false;
toggle.onclick=()=>{
  panel.hidden=!panel.hidden;
  active=!panel.hidden;
  window.workModeEdgeMode=active;
  toggle.textContent=active?'Edge tab selected':'My Edge tabs';
  if(active){
    if(window.showMobileView)window.showMobileView('browser');
    report(check());
  }
};
el('edgeCheck').onclick=()=>report(locked(check));
el('edgeRead').onclick=()=>report(locked(inspect));
el('edgeClick').onclick=()=>report(locked(async()=>{
  const result=await click(selected());
  if(result?.ok){snapshot=null;feedback('Click completed. The final website outcome has not been verified; read the page again.');}
}));
el('edgeFill').onclick=()=>report(locked(async()=>{
  const result=await fill(selected(),el('edgeText').value);
  if(result?.ok){snapshot=null;feedback('Typed into the selected non-secret field. Review the website to verify.');}
}));
for(const direction of ['up','down']){
  el('edgeScroll'+(direction==='up'?'Up':'Down')).onclick=()=>report(locked(async()=>{
    await request('scroll',{direction});await inspect();
  }));
}
window.WorkModeEdgeAPI={request,check,inspect,click,fill,locked,feedback,status,sleep,controls:()=>snapshot?.controls||[]};
window.workModeRunEdgeCommand=async task=>{
  const input=String(task||'').trim();
  if(/^(hi|hello|help|commands)[!?. ]*$/i.test(input))return 'Edge commands: Read the page; Scroll up; Scroll down; Click [exact label]; Type "text" into "field label"; Open https://... on the approved site; Verify page contains [text]. You can also prepare and review a Facebook group post in My Edge tabs. Advanced reasoning requires an AI model.';
  const connected=await check();
  if(!connected.connected)throw Error('Connect a website tab by clicking the Edge extension icon on that tab.');
  if(/^read (?:the |this |current )?(?:web)?page[.! ]*$/i.test(input)){
    const page=await inspect();return 'Page: '+page.title+'\n'+page.url+'\n\n'+page.text.slice(0,1800);
  }
  const scroll=input.match(/^scroll (up|down)[.! ]*$/i);
  if(scroll){await request('scroll',{direction:scroll[1].toLowerCase()});return 'Scrolled the Edge tab '+scroll[1]+'.';}
  const open=input.match(/^(?:open|go to|navigate to) (https?:\/\/\S+)/i);
  if(open){await request('navigate',{url:open[1]});return 'Navigation requested: '+open[1]+'. Read the page to verify.';}
  const verify=input.match(/^verify (?:page )?contains (.+)$/i);
  if(verify){const r=await request('verify',{kind:'text',expected:verify[1]});return r.verified?'Verified page contains "'+verify[1]+'".':'Not verified: expected text was not found.';}
  const press=input.match(/^(?:click|tap) (.+)$/i);
  if(press){
    const p=await inspect(),items=(p.controls||[]).filter(c=>c.label.toLowerCase()===press[1].trim().toLowerCase());
    if(items.length!==1)throw Error('Found '+items.length+' matching controls. Choose the exact visible control rather than guessing.');
    const r=await click(items[0]);return r?.ok?'Clicked. Check the site for the result.':'Click cancelled.';
  }
  const type=input.match(/^type "([^"]+)" into "([^"]+)"$/i);
  if(type){
    const p=await inspect(),items=(p.controls||[]).filter(c=>c.editable&&!c.sensitive&&c.label.toLowerCase()===type[2].toLowerCase());
    if(items.length!==1)throw Error('Field "'+type[2]+'" is not uniquely identified. Read the page and choose a field.');
    await fill(items[0],type[1]);return 'Typed text into "'+type[2]+'". Verify it in Edge.';
  }
  return 'That instruction requires reasoning beyond the built-in commands. No action was taken. Use the visible Edge controls or the group post workflow.';
};
})();