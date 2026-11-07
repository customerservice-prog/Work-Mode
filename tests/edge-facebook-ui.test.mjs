import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

test('Edge tab connector prepares a group post, requests explicit confirmation and verifies a simulated feed article', {timeout:25000}, async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
    const edge=await fs.readFile(new URL('../public/edge-tabs.js',import.meta.url),'utf8');
    const facebook=await fs.readFile(new URL('../public/edge-facebook.js',import.meta.url),'utf8');
    await page.route('https://work-mode-production.up.railway.app/**',async route=>{
      if(route.request().url().endsWith('/')){
        const cleaned=html.replace(/<script src="\/[^"]+" defer><\/script>/g,'');
        await route.fulfill({status:200,contentType:'text/html',body:cleaned});
      } else await route.fulfill({status:404,body:''});
    });
    await page.goto('https://work-mode-production.up.railway.app/');
    await page.evaluate(()=>{
      window.confirm=()=>true;
      window.__sim={stage:'home',url:'https://www.facebook.com/',calls:[],postCount:0,text:''};
      const reply=(request,result)=>{
        window.postMessage({channel:'WORKMODE_EXTENSION_REPLY',id:request.id,ok:true,result},location.origin);
      };
      window.addEventListener('message',event=>{
        const msg=event.data;
        if(msg?.channel!=='WORKMODE_PAGE_REQUEST')return;
        const state=window.__sim;
        state.calls.push(msg.action);
        const action=msg.action;
        if(action==='status')return reply(msg,{installed:true,connected:true,tab:{id:42,title:'Facebook',url:state.url}});
        if(action==='navigate'){
          state.url=msg.args.url;state.stage='group';
          return reply(msg,{ok:true,url:state.url});
        }
        if(action==='inspect'){
          let controls=[];
          if(state.stage==='group')controls=[{id:'1',label:'Write something',tag:'button',editable:false,highImpact:false,sensitive:false}];
          if(state.stage==='editor')controls=[{id:'2',label:'Write something',tag:'div',editable:true,highImpact:false,sensitive:false}];
          if(state.stage==='filled'||state.stage==='published')controls=[{id:'3',label:'Post',tag:'button',editable:false,highImpact:true,sensitive:false}];
          return reply(msg,{ok:true,url:state.url,title:'Test Facebook Group',text:state.text||'Group discussion',
            controls,snapshot:'snapshot123'});
        }
        if(action==='click'){
          if(msg.args.id==='1')state.stage='editor';
          if(msg.args.id==='3'){state.stage='published';state.postCount++;}
          return reply(msg,{ok:true,label:'Clicked'});
        }
        if(action==='fill'){state.text=msg.args.text;state.stage='filled';return reply(msg,{ok:true});}
        if(action==='verify_post')return reply(msg,{ok:true,matchingArticles:state.postCount,
            pendingApproval:false,permalink:state.postCount?'https://www.facebook.com/groups/12345678/posts/9876543/':null});
        return reply(msg,{ok:true});
      });
    });
    await page.addScriptTag({content:edge});
    await page.addScriptTag({content:facebook});
    await page.locator('#edgeToggle').click();
    await page.waitForFunction(()=>document.querySelector('#edgeStatus').textContent.includes('Connected to'));
    await page.locator('#edgeGroupUrl').fill('https://www.facebook.com/groups/12345678/');
    await page.locator('#edgeGroupPost').fill('Test group post from Work-Mode Edge connector');
    await page.locator('#edgePrepare').click();
    await page.waitForFunction(()=>document.querySelector('#edgeFeedback').textContent.includes('DRAFT READY'));
    assert.equal(await page.locator('#edgePublish').isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.__sim.postCount),0);
    await page.locator('#edgePublish').click();
    await page.waitForFunction(()=>document.querySelector('#edgeFeedback').textContent.includes('VERIFIED'));
    assert.equal(await page.evaluate(()=>window.__sim.postCount),1);
    assert.deepEqual(await page.evaluate(()=>window.__sim.calls.filter(c=>c==='click')),['click','click']);
    assert.equal(await page.locator('#edgePublish').isEnabled(),false);
  }finally{await browser.close();}
});
