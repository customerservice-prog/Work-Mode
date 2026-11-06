import test from 'node:test';
import assert from 'node:assert/strict';
import { selectModel, hardwareInfo, runtimeStatus } from '../lib/embedded-runtime.js';
import { localTools, runEmbeddedAgent } from '../lib/embedded-agent.js';

const GiB=1024**3;
const allTools=[
 {type:'function',name:'navigate',description:'Open website',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}},
 {type:'function',name:'read_page',description:'Read controls',parameters:{type:'object',properties:{}}},
 {type:'function',name:'click_element',description:'Click control',parameters:{type:'object',properties:{id:{type:'string'}}}},
 {type:'function',name:'verify_page',description:'Verify result',parameters:{type:'object',properties:{expected:{type:'string'}}}},
 {type:'function',name:'inspect_visual',description:'Look at screenshot',parameters:{type:'object',properties:{}}}
];
function response(call,step) {
 return {choices:[{finish_reason:'stop',message:call
   ? {role:'assistant',content:null,tool_calls:[{id:'call_'+step,type:'function',
       function:{name:call[0],arguments:JSON.stringify(call[1])}}]}
   : {role:'assistant',content:'The test condition was verified.',tool_calls:[]}}]};
}
test('Low-memory hardware selects compact model without requiring Ollama',()=>{
 assert.equal(selectModel(2*GiB),'unsupported');
 assert.equal(selectModel(4*GiB),'lite');
 assert.equal(selectModel(8*GiB),'standard');
 assert.equal(runtimeStatus().requiresOllama,false);
 assert.ok(typeof hardwareInfo().totalMemoryGiB==='number');
 assert.equal(localTools(allTools).some(x=>x.function.name==='inspect_visual'),false);
});
test('Included text model can call browser tools and verify a simulated task',async()=>{
 const calls=[['navigate',{url:'https://example.org'}],['read_page',{}],['click_element',{id:'1'}],['verify_page',{expected:'Action verified'}]];
 let n=0, didInspectContext=false;
 const client={chat:{completions:{create:async body=>{
   if(n>0) didInspectContext=body.messages.some(x=>x.role==='tool');
   const r=response(calls[n],n);n++;return r;
 }}}};
 const executed=[];
 const result=await runEmbeddedAgent({
  client,task:'Open test page, click, verify',tools:allTools,policy:'Only operate at the user request',
  execute:async(name,args)=>{
   executed.push(name);
   if(name==='read_page')return {revision:1,text:'Test page',controls:[{id:'1',tag:'button',label:'Run'}]};
   if(name==='verify_page')return {verified:true};
   return {ok:true};
  },
  maxSteps:8
 });
 assert.deepEqual(executed,calls.map(x=>x[0]));
 assert.equal(result.verified,true);
 assert.equal(result.steps,4);
 assert.equal(result.limitReached,false);
 assert.ok(didInspectContext);
});
test('Included AI never claims completion when a page change was not verified',async()=>{
 let n=0;
 const client={chat:{completions:{create:async()=>response(n++===0?['click_element',{id:'1'}]:null,n)}}};
 const result=await runEmbeddedAgent({
  client,task:'Do something',tools:allTools,policy:'Be accurate',
  execute:async()=>({ok:true}),maxSteps:5
 });
 assert.equal(result.verified,false);
 assert.match(result.answer,/not verified|no successful page verification/i);
});
test('When repeated local browser tools fail, the agent stops instead of retrying forever',async()=>{
 let n=0;
 const client={chat:{completions:{create:async()=>response(['click_element',{id:'1'}],n++)}}};
 const result=await runEmbeddedAgent({
  client,task:'Bad clicks',tools:allTools,policy:'Stay safe',
  execute:async()=>{throw Error('Stale element')},maxSteps:10
 });
 assert.equal(result.limitReached,true);
 assert.ok(result.steps<=5);
 assert.equal(result.verified,false);
});
