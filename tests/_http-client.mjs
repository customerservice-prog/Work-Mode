import http from 'node:http';

export function requestWithHost(base, endpoint, options = {}) {
  const url = new URL(endpoint, base);
  const method = options.method || 'GET';
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  const headers = {
    Host: options.host || url.host,
    ...(options.origin ? { Origin: options.origin } : {}),
    ...(options.cookie ? { Cookie: options.cookie } : {}),
    ...(options.headers || {}),
    ...(body === null ? {} : { 'Content-Type':'application/json','Content-Length':Buffer.byteLength(body) })
  };
  return new Promise((resolve,reject) => {
    const request = http.request({
      hostname:url.hostname,port:Number(url.port),path:url.pathname+url.search,
      method,headers,timeout:options.timeoutMs||11000
    },response => {
      const chunks = [];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>{
        const bytes=Buffer.concat(chunks);
        resolve({
          status:response.statusCode,
          headers:{get(name){
            const value=response.headers[String(name).toLowerCase()];
            return Array.isArray(value)?value[0]:value ?? null;
          }},
          text:async()=>bytes.toString(),
          arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),
          json:async()=>JSON.parse(bytes.toString())
        });
      });
      response.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('Request timeout')));
    request.on('error',reject);
    if(body!==null)request.write(body);
    request.end();
  });
}
