// Owner-configured inference. Credentials never come from an HTTP request.
// Compatible endpoints use the OpenAI Responses API and retain the full tool transcript.
export function hostedAI(env = process.env) {
  const raw = String(env.WORKMODE_AI_BASE_URL || '').trim();
  if (raw) {
    let url;
    try { url = new URL(raw); }
    catch { throw Error('WORKMODE_AI_BASE_URL is not a valid URL'); }
    const privateRailway = /^[a-z0-9-]+\.railway\.internal$/i.test(url.hostname);
    const testLoopback = env.NODE_ENV === 'test' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && (privateRailway || testLoopback)))) {
      throw Error('WORKMODE_AI_BASE_URL needs HTTPS or a private Railway endpoint, without embedded credentials');
    }
    const model = String(env.WORKMODE_AI_MODEL || '').trim();
    if (!model || model.length > 120) throw Error('WORKMODE_AI_MODEL is required with WORKMODE_AI_BASE_URL');
    return Object.freeze({
      mode:'compatible',model,baseURL:url.href.replace(/\/+$/,''),
      apiKey:String(env.WORKMODE_AI_API_KEY || 'workmode-self-hosted'),
      configured:true,stateless:true
    });
  }
  const apiKey=String(env.OPENAI_API_KEY || '').trim();
  return Object.freeze({mode:apiKey?'openai':'basic',
    model:String(env.OPENAI_MODEL || 'gpt-4.1-mini'),apiKey,
    configured:Boolean(apiKey),stateless:false});
}
