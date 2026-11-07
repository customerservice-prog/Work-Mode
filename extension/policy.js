/* Intentionally small shared policy, works in both MV3 and Node test VM. */
globalThis.WorkModeTabPolicy = (() => {
  const SITE = 'https://work-mode-production.up.railway.app';
  const SECRET = /(?:password|passcode|one.?time|otp|verification|2fa|mfa|secret|api.?key|token|credit.?card|cvv|cvc|routing|account.?number|social.?security)/i;
  const HIGH = /(?:\bpost\b|\bpublish\b|\bshare\b|\bsend\b|\bsubmit\b|\bpay\b|\bbuy\b|\border\b|\bdelete\b|\bremove\b|\bconfirm\b|\bapprove\b|\bjoin\b|\binvite\b|\bupload\b|\blog\s?out\b|\bsign\s?out\b)/i;
  function supportedUrl(raw) {
    try {
      const u=new URL(raw);
      return ['http:','https:'].includes(u.protocol) &&
        !['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname) &&
        !u.hostname.endsWith('.internal') && !u.username && !u.password;
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
