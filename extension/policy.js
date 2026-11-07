/* Intentionally small shared policy, works in both MV3 and Node test VM. */
globalThis.WorkModeTabPolicy = (() => {
  const SITE = 'https://work-mode-production.up.railway.app';
  const SECRET = /(?:password|passcode|one.?time|otp|verification|2fa|mfa|secret|api.?key|token|credit.?card|cvv|cvc|routing|account.?number|social.?security)/i;
  const HIGH = /(?:\bpost\b|\bpublish\b|\bshare\b|\bsend\b|\bsubmit\b|\bpay\b|\bbuy\b|\border\b|\bdelete\b|\bremove\b|\bconfirm\b|\bapprove\b|\bjoin\b|\binvite\b|\bupload\b|\blog\s?out\b|\bsign\s?out\b)/i;
  function supportedUrl(raw) {
    try {
      const u=new URL(raw);
      const host=u.hostname.toLowerCase().replace(/^\\[|\\]$/g,'');
      const octets=host.split('.').map(Number);
      const isIpv4=octets.length===4 && octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255);
      const privateIp=isIpv4 && (octets[0]===0||octets[0]===10||octets[0]===127||
        octets[0]>=224||(octets[0]===169&&octets[1]===254)||
        (octets[0]===172&&octets[1]>=16&&octets[1]<=31)||
        (octets[0]===192&&octets[1]===168)||
        (octets[0]===100&&octets[1]>=64&&octets[1]<=127));
      const privateV6=host.includes(':')&&(/^(::|::1|fc|fd|fe8|fe9|fea|feb)/.test(host));
      return ['http:','https:'].includes(u.protocol) &&
        !['localhost','metadata','metadata.google.internal'].includes(host) &&
        !host.endsWith('.internal') && !host.endsWith('.local') &&
        !privateIp && !privateV6 &&
        !u.username && !u.password;
    } catch{return false;}
  }
  function fromWorkMode(sender) {
    try {return new URL(sender?.url || sender?.tab?.url).origin===SITE;} catch{return false;}
  }
  function isSecret(meta) {return SECRET.test([meta?.label,meta?.name,meta?.type,meta?.placeholder].filter(Boolean).join(' '));}
  function highImpact(meta) {return HIGH.test([meta?.label,meta?.text,meta?.type,meta?.title].filter(Boolean).join(' '));}
  function allowAction(action) {
    return ['status','inspect','click','fill','scroll','navigate','verify','tabs','back','screenshot','verify_post'].includes(action);
  }
  return Object.freeze({SITE,supportedUrl,fromWorkMode,isSecret,highImpact,allowAction});
})();
