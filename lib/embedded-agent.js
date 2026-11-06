/**
 * Text-only Chat Completions browser-agent loop for the bundled llama.cpp model.
 * All actual browser actions run through the existing approval/verification
 * implementation in server.js. A small model is NOT trusted to certify success.
 */
const MAIN_TOOLS = new Set([
  'navigate','read_page','click_element','fill_element','scroll_page',
  'verify_page','press_key','list_tabs','switch_tab','go_back'
]);
export function localTools(browserTools) {
  return browserTools.filter(x=>MAIN_TOOLS.has(x.name)).map(x=>({
    type:'function',
    function:{ name:x.name,description:x.description,parameters:x.parameters }
  }));
}
function compactResult(name, result) {
  if(!result||typeof result!=='object')return result;
  if(name!=='read_page')return result;
  return {
    revision:result.revision,
    url:String(result.url||'').slice(0,280),
    title:String(result.title||'').slice(0,130),
    text:String(result.text||'').slice(0,1800),
    controls:Array.isArray(result.controls)?result.controls.slice(0,24).map(c=>({
      id:c.id,tag:c.tag,type:c.type,label:String(c.label||'').slice(0,70),
      href:c.href,value:String(c.value||'').slice(0,45)
    })):[]
  };
}
const MAX_CONTEXT_CHARS = 12500;
export async function runEmbeddedAgent({
 client, task, tools, policy, execute, log=()=>{}, isStopped=()=>false,
 model='workmode-local', maxSteps=16, onStep=()=>{}
}) {
 const offered=localTools(tools);
 const messages=[
  {role:'system',content:policy + '\nYou are using a small offline text-only model on a low-cost Windows computer. You cannot interpret screenshots. Read the page before interacting; use verify_page to check any claimed result. If you cannot safely finish a task, clearly state what remains undone. Do not invent clicks, checks, or completed actions. Do not request secrets in chat.'},
  {role:'user',content:String(task)}
 ];
 const groups=[];
 let steps=0;
 let verificationPassed=false;
 let didAct=false;
 let failedTools=0;
 while(steps<maxSteps){
  if(isStopped())throw Error('Task stopped');
  let response;
  try {
   response=await client.chat.completions.create({
     model,messages:[...messages,...groups.flat()],tools:offered,tool_choice:'auto',
     temperature:0.1,max_tokens:800,
     chat_template_kwargs:{enable_thinking:false}
   });
  }catch(err){
   throw new Error('Built-in AI could not respond: '+String(err.message||err).slice(0,220));
  }
  if(isStopped())throw Error('Task stopped');
  const assistant=response.choices?.[0]?.message;
  if(!assistant)throw Error('Built-in AI returned an empty response');
  const calls=Array.isArray(assistant.tool_calls)?assistant.tool_calls:[];
  if(!calls.length){
   let answer=typeof assistant.content==='string'?assistant.content.trim():'';
   if(!answer)answer='The built-in AI did not provide an explanation.';
   if(didAct && !verificationPassed){
    answer+='\n\nNo successful page verification was recorded. Review the browser before treating the task as complete.';
   }
   return {answer,steps,verified:verificationPassed,usedTools:didAct,limitReached:response.choices?.[0]?.finish_reason==='length'};
  }
  const group=[{role:'assistant',content:assistant.content||null,tool_calls:calls}];
  for(const call of calls){
   if(isStopped())throw Error('Task stopped');
   const name=String(call.function?.name||'');
   const output={role:'tool',tool_call_id:call.id||('missing_'+steps),content:''};
   if(!offered.some(t=>t.function.name===name)){
    output.content=JSON.stringify({ok:false,error:'Unsupported action'});
    group.push(output);
    failedTools++;
    continue;
   }
   if(steps>=maxSteps){
    output.content=JSON.stringify({ok:false,error:'Action limit reached'});
    group.push(output);
    break;
   }
   steps++;didAct=true;
   onStep(steps);
   log('Built-in AI action '+steps+': '+name);
   let result;
   try{
    const args=JSON.parse(call.function?.arguments||'{}');
    result=await execute(name,args);
    if(result?.image)result=result.result||{ok:false,error:'Visual inspection is not supported by built-in text-only AI'};
    if(name==='verify_page'&&result?.verified===true)verificationPassed=true;
    if(result?.ok===false)failedTools++;
   }catch(err){
    result={ok:false,error:String(err.message||err).slice(0,300)};
    failedTools++;
    log('Action problem: '+result.error);
   }
   output.content=JSON.stringify(compactResult(name,result)).slice(0,4500);
   group.push(output);
  }
  groups.push(group);
  // Drop complete older assistant/tool groups together to avoid invalid tool
  // associations in Chat Completions; preserve the task and system policy.
  while(groups.length>2&&JSON.stringify(groups).length>MAX_CONTEXT_CHARS)groups.shift();
  if(failedTools>=5){
   return {answer:'Too many browser actions failed. The task is not verified; inspect the browser before trying again.',steps,verified:false,usedTools:didAct,limitReached:true};
  }
 }
 return {answer:'The built-in AI reached its action limit without a confirmed final result. Review the browser before continuing.',steps,verified:verificationPassed,usedTools:didAct,limitReached:true};
}
