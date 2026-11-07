// One explicit Facebook group post at a time. No unattended posting or retries.
(() => {
const api=window.WorkModeEdgeAPI;
if(!api)return;
const el=id=>document.getElementById(id);
let draft=null;
const failed=error=>api.feedback(String(error?.message||error));
function groupUrl(raw){
  let url;
  try {url=new URL(String(raw||'').trim());}catch{throw Error('Enter a direct Facebook group URL.');}
  if(url.protocol!=='https:'||!['facebook.com','www.facebook.com','web.facebook.com','m.facebook.com'].includes(url.hostname.toLowerCase()))
    throw Error('Only direct Facebook group URLs are allowed.');
  if(!/^\/groups\/[a-z0-9_.-]{4,90}\/?$/i.test(url.pathname))
    throw Error('Use a specific Facebook group address, such as https://www.facebook.com/groups/123456789/.');
  return url.origin+url.pathname;
}
const contains=(c,regex)=>regex.test(String(c.label||''));
async function prepare(){
  if(draft)throw Error('A draft has already been prepared or sent. Check Facebook before making another.');
  const url=groupUrl(el('edgeGroupUrl').value);
  const message=el('edgeGroupPost').value.trim();
  if(message.length<5||message.length>3000)throw Error('Write a post between 5 and 3000 characters.');
  const connected=await api.check();
  if(!connected.connected)throw Error('Connect your existing Facebook tab from the Edge extension first.');
  if(new URL(connected.tab.url).origin!==new URL(url).origin)
    throw Error('Connect a tab on the same Facebook website domain as your group URL.');
  api.feedback('Navigating to the group. Nothing has been posted.');
  await api.request('navigate',{url});
  await api.sleep(1600);
  let page=await api.inspect();
  if(!page.url.startsWith(new URL(url).origin+'/groups/'))
    throw Error('Facebook redirected away from the group. Sign in or join the group manually in Edge first.');
  let editors=(page.controls||[]).filter(c=>c.editable&&!c.sensitive&&['div','textarea'].includes(c.tag));
  if(editors.length!==1){
    const composers=(page.controls||[]).filter(c=>contains(c,/write something|what.?s on your mind|create a post|write a post|start discussion/i));
    if(composers.length!==1)
      throw Error('Could not uniquely identify the group post composer. Open it manually in Edge, then try Prepare again.');
    await api.click(composers[0],true);
    await api.sleep(700);
    page=await api.inspect();
    editors=(page.controls||[]).filter(c=>c.editable&&!c.sensitive&&['div','textarea'].includes(c.tag));
  }
  if(editors.length!==1){
    const preferred=editors.filter(c=>contains(c,/write something|what.?s on your mind|post|discussion/i));
    if(preferred.length!==1)
      throw Error('Multiple possible Facebook editors. Select the intended field manually in Edge, then retry.');
    editors=preferred;
  }
  await api.fill(editors[0],message);
  await api.sleep(300);
  page=await api.inspect();
  if(!page.text.includes(message.slice(0,Math.min(60,message.length))))
    throw Error('The post text was not verified in the Facebook composer. Nothing was published.');
  const existing=await api.request('verify_post',{expected:message.slice(0,180)});
  if(existing.matchingArticles>0)
    throw Error('A matching post already exists in the group feed. Check for duplicates before publishing.');
  draft={url,text:message,tabId:connected.tab.id,baseline:existing.matchingArticles,status:'prepared',createdAt:Date.now()};
  el('edgePublish').disabled=false;
  return 'DRAFT READY, NOT PUBLISHED.\nReview the group, account and message in the real Edge tab. Then click Review & publish once.';
}
async function publish(){
  if(!draft||draft.status!=='prepared')throw Error('No prepared Facebook draft. Nothing was published.');
  if(Date.now()-draft.createdAt>8*60*1000)throw Error('The draft expired. Review Facebook and prepare it again.');
  const state=await api.check();
  if(!state.connected||state.tab.id!==draft.tabId||!state.tab.url.startsWith(new URL(draft.url).origin+'/groups/'))
    throw Error('Connected tab or group changed. Nothing was published.');
  const page=await api.inspect();
  if(!page.text.includes(draft.text.slice(0,Math.min(60,draft.text.length))))
    throw Error('Prepared text is missing from the composer. Nothing was published.');
  const posts=(page.controls||[]).filter(c=>/^(post|publish)$/i.test(String(c.label||''))&&!c.editable);
  if(posts.length!==1)throw Error('Could not locate one unique Post/Publish button. Nothing was published.');
  if(!window.confirm('FINAL APPROVAL: Publish this Facebook group post from the signed-in Edge account?\n\nGroup: '+draft.url+'\n\n'+draft.text.slice(0,450))) {
    return 'Publication cancelled. No Post click was sent.';
  }
  draft.status='submitting';
  el('edgePublish').disabled=true;
  try {
    const result=await api.click(posts[0],true);
    if(!result?.ok)throw Error('Click was not confirmed');
  }catch(error){
    draft.status='unconfirmed';
    return 'A publish action was attempted, but its outcome is UNKNOWN: '+error.message+'. Check Facebook before retrying.';
  }
  await api.sleep(1400);
  try {
    const verified=await api.request('verify_post',{expected:draft.text.slice(0,180)});
    if(verified.pendingApproval){
      draft.status='pending';
      return 'Facebook indicates this post is PENDING GROUP APPROVAL. It is not confirmed publicly visible.';
    }
    if(verified.matchingArticles>draft.baseline){
      draft.status='published';
      return 'VERIFIED: A new matching post is visible in a Facebook group feed article.'+(verified.permalink?'\nPost: '+verified.permalink:'');
    }
    draft.status='unconfirmed';
    return 'Post was clicked, but Facebook did not show a newly verified group feed article. The outcome is UNKNOWN; do not post again until checking.';
  }catch(error){
    draft.status='unconfirmed';
    return 'Post was clicked, but verification failed: '+error.message+'. Check Facebook before retrying.';
  }
}
el('edgePrepare').addEventListener('click',()=>void api.locked(async()=>{
  try{api.feedback(await prepare());}
  catch(error){failed(error);}
}).catch(failed));
el('edgePublish').addEventListener('click',()=>void api.locked(async()=>{
  try{api.feedback(await publish());}
  catch(error){failed(error);}
}).catch(failed));
})();
