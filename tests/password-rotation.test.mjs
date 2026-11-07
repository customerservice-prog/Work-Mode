import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHostedAuth} from '../lib/hosted-auth.js';
import {requestWithHost} from './_http-client.mjs';

test('owner can rotate leaked password privately, revoking all sessions and surviving restart', {timeout:15000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-password-'));
 const conf={enabled:true,origin:'https://workmode.example.com',password:'original-long-safe-test-password',
   secret:'testing-secret-key-over-thirty-two-characters',
   sessionFile:path.join(dir,'sessions.json'),
   passwordFile:path.join(dir,'password.json')};
 let security=createHostedAuth(conf);
 const app=express();app.use(express.json());app.use((req,res,next)=>security.middleware(req,res,next));
 app.get('/api/status',(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 const request=(endpoint,method='GET',body,cookie,origin='https://workmode.example.com')=>
   requestWithHost(base,endpoint,{host:'workmode.example.com',origin,method,
     ...(body===undefined?{}:{body}),cookie});
 try {
   assert.equal((await request('/api/auth/change-password','POST',{currentPassword:'x',newPassword:'x'.repeat(30)})).status,401);
   const signIn=await request('/api/auth/login','POST',{password:conf.password});
   assert.equal(signIn.status,200);
   const cookie=signIn.headers.get('set-cookie').split(';')[0];
   assert.equal((await request('/api/status','GET',undefined,cookie)).status,200);
   assert.equal((await request('/api/auth/change-password','POST',{
     currentPassword:conf.password,newPassword:'different-password-for-testing-over-20'
   },cookie,'https://outside.example')).status,403);
   assert.equal((await request('/api/auth/change-password','POST',{
     currentPassword:'wrong',newPassword:'different-password-for-testing-over-20'
   },cookie)).status,401);
   assert.equal((await request('/api/auth/change-password','POST',{
     currentPassword:conf.password,newPassword:'short'
   },cookie)).status,400);
   const newPassword='different-password-for-testing-over-20';
   const rotation=await request('/api/auth/change-password','POST',{
     currentPassword:conf.password,newPassword},cookie);
   assert.equal(rotation.status,200);
   assert.equal((await request('/api/status','GET',undefined,cookie)).status,401);
   assert.equal((await request('/api/auth/login','POST',{password:conf.password})).status,401);
   const replacement=await request('/api/auth/login','POST',{password:newPassword});
   assert.equal(replacement.status,200);
   const saved=await fs.readFile(conf.passwordFile,'utf8');
   assert.equal(saved.includes(newPassword),false);
   assert.equal(saved.includes(conf.password),false);
   security=createHostedAuth(conf);
   assert.equal((await request('/api/auth/login','POST',{password:conf.password})).status,401);
   assert.equal((await request('/api/auth/login','POST',{password:newPassword})).status,200);
 }finally{
   server.closeAllConnections();
   await new Promise(r=>server.close(r));
   await fs.rm(dir,{recursive:true,force:true});
 }
});
