import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHostedAuth } from '../lib/hosted-auth.js';

test('private hosted mode gates remote pages and APIs and prevents cross-site writes', {timeout:12000}, async () => {
  const security=createHostedAuth({
    enabled:true,origin:'https://workmode.example.com',
    password:'strong-passphrase-for-integration',
    secret:'test-secret-exceeds-thirty-two-characters',
  });
  const app=express();
  app.use(express.json());
  app.use(security.middleware);
  app.get('/login',(_req,res)=>res.send('login'));
  app.get('/api/secret',(_req,res)=>res.json({private:true}));
  app.post('/api/write',(_req,res)=>res.json({saved:true}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  async function request(path,{method='GET',cookie='',body,origin}={}){
    const headers={Host:'workmode.example.com', ...(cookie?{Cookie:cookie}:{}), ...(origin?{Origin:origin}:{}), ...(body?{'Content-Type':'application/json'}:{})};
    return fetch(root+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
  }
  try {
    const unauth=await request('/api/secret');
    assert.equal(unauth.status,401);
    const page=await request('/');
    assert.equal(page.status,302);
    assert.equal(page.headers.get('location'),'/login');
    const loginPage=await request('/login');
    assert.equal(loginPage.status,200);
    const cross=await request('/api/auth/login',{method:'POST',origin:'https://attacker.example',body:{password:'strong-passphrase-for-integration'}});
    assert.equal(cross.status,403);
    const bad=await request('/api/auth/login',{method:'POST',origin:'https://workmode.example.com',body:{password:'incorrect'}});
    assert.equal(bad.status,401);
    const login=await request('/api/auth/login',{method:'POST',origin:'https://workmode.example.com',body:{password:'strong-passphrase-for-integration'}});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'),/Secure/);
    assert.match(login.headers.get('set-cookie'),/HttpOnly/);
    assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
    assert.equal((await request('/api/secret',{cookie})).status,200);
    assert.equal((await request('/api/auth/session',{cookie})).status,200);
    const wrongHost=await fetch(root+'/api/secret',{headers:{Host:'other.example.com',Cookie:cookie}});
    assert.equal(wrongHost.status,403);
    const crossWrite=await request('/api/write',{method:'POST',cookie,origin:'https://evil.example',body:{x:1}});
    assert.equal(crossWrite.status,403);
    const ownWrite=await request('/api/write',{method:'POST',cookie,origin:'https://workmode.example.com',body:{x:1}});
    assert.equal(ownWrite.status,200);
    const logout=await request('/api/auth/logout',{method:'POST',cookie,origin:'https://workmode.example.com'});
    assert.equal(logout.status,200);
    assert.equal((await request('/api/secret',{cookie})).status,401);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('hosted mode fails closed without strong credentials or HTTPS origin', () => {
  assert.throws(()=>createHostedAuth({enabled:true,origin:'http://example.com',password:'a'.repeat(25),secret:'s'.repeat(50)}));
  assert.throws(()=>createHostedAuth({enabled:true,origin:'https://example.com',password:'short',secret:'s'.repeat(50)}));
  assert.throws(()=>createHostedAuth({enabled:true,origin:'https://example.com',password:'a'.repeat(25),secret:'short'}));
  assert.equal(createHostedAuth({enabled:false}).enabled,false);
});
