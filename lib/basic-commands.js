// Strict, deterministic commands for a hosted Work-Mode browser with no AI API.
// This is not an LLM and must never claim to complete arbitrary natural-language tasks.
export const BASIC_HELP = [
  'Free browser command mode is available (no AI model or API needed).',
  'Try: "Open https://www.google.com and tell me the page title",',
  '"Search the web for party tents", "Read the page", "Scroll down",',
  '"List tabs", "Click Search", "Type \"party tents\" into \"Search\"",',
  '"Verify page contains Google", or "Take a screenshot".',
  'For multi-step reasoning, research, autonomous decisions or complex site audits, a separate AI model is required.'
].join('\\n');

function webAddress(candidate) {
  const value = String(candidate || '').trim();
  if (!/^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

export function parseBasicCommand(input) {
  const task = String(input || '').trim();
  const lower = task.toLowerCase();
  if (!task || /^(?:help|commands|what can you do|show commands)[?.!]*$/i.test(task)) return {kind:'help'};
  if (/^(?:hi|hey|hello|hola|good morning|good afternoon)[!?. ]*$/i.test(task)) return {kind:'greeting'};
  if (/^(?:go back|back|previous page)[.! ]*$/i.test(task)) return {kind:'back'};
  if (/^(?:list|show|what are) (?:my |open )?tabs[?.! ]*$/i.test(task)) return {kind:'tabs'};
  if (/^(?:take (?:a )?screenshot|screenshot|refresh (?:the )?preview)[.! ]*$/i.test(task)) return {kind:'screenshot'};
  if (/^(?:read|inspect|show|summarize) (?:this |the |current )?(?:web)?page[.! ]*$/i.test(task)) return {kind:'read'};
  if (/^(?:what is|what's|tell me) (?:the |this |current )?(?:web)?page(?:'s)? title[?.! ]*$/i.test(task) || /^(?:page title|title of (?:this |the )?page)[?.! ]*$/i.test(task)) return {kind:'title'};
  if (/^scroll (up|down)[.! ]*$/i.test(task)) return {kind:'scroll',direction:lower.includes('up')?'up':'down'};
  const switchMatch=task.match(/^(?:switch to|select) tab (\d+)[.! ]*$/i);
  if (switchMatch) return {kind:'switch_tab',index:Number(switchMatch[1])};
  const verify=task.match(/^verify (?:the |this )?(?:web)?page (?:contains|includes|has)\s+(.+?)\s*[.!]?$/i);
  if (verify) return {kind:'verify',kindToCheck:'text',expected:verify[1].replace(/^[\"']|[\"']$/g,'')};
  const search=task.match(/^(?:search (?:the )?(?:web|internet|google) for|google|search for)\s+(.+)$/i);
  if (search) return {kind:'navigate',url:'https://www.google.com/search?q='+encodeURIComponent(search[1].trim()),reportTitle:true};
  const urlMatch=task.match(/^(?:open|navigate to|go to|visit|browse|load|open a new tab at)\s+(\S+)(.*)$/i);
  if (urlMatch) {
    const url=webAddress(urlMatch[1].replace(/[,.!?]+$/,''));
    if (!url) return {kind:'unsupported'};
    return {kind:/^open a new tab/i.test(task)?'new_tab':'navigate',url,reportText:/\b(?:read|inspect|summari[sz]e|what(?:'s| is) on)\b/i.test(urlMatch[2]),reportTitle:/\btitle\b/i.test(urlMatch[2])};
  }
  const click=task.match(/^(?:click|tap|press button)\s+(.+?)\s*[.!]?$/i);
  if (click) return {kind:'click',label:click[1].replace(/^(?:on|the button|the link|button)\s+/i,'').replace(/^[\"']|[\"']$/g,'').trim()};
  const fill=task.match(/^(?:type|enter|fill)\s+[\"'](.+?)[\"']\s+(?:in|into)\s+[\"'](.+?)[\"']\s*[.!]?$/i);
  if (fill) return {kind:'fill',value:fill[1],label:fill[2]};
  const key=task.match(/^press (Tab|Escape|ArrowDown|ArrowUp|Enter)[.! ]*$/i);
  if (key) return {kind:'press_key',key:key[1].slice(0,1).toUpperCase()+key[1].slice(1)};
  return {kind:'unsupported'};
}
