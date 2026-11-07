import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

test('hosted no-API mode keeps basic task button enabled and labels it accurately', {timeout:25000}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
    const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
    const settings=await fs.readFile(new URL('../public/settings.js',import.meta.url),'utf8');
    const remote=await fs.readFile(new URL('../public/remote.js',import.meta.url),'utf8');
    const page=await browser.newPage({viewport:{width:1200,height:840}});
    await page.setContent(html);
    await page.evaluate(()=>{
      window.EventSource=class { constructor() {} };
      window.fetch=async url=>{
        const path=String(url);
        const result = path==='/api/mode' ? {cloud:true} :
          path==='/api/settings' ? {cloud:true,provider:'openai',openaiModel:'gpt-4.1-mini',hasApiKey:false} :
          path==='/api/cloud/readiness' ? {
            aiConfigured:false, dataDirectoryConfigured:true, dataDirectoryWritable:true,
            volumeAttached:true,browserInstalled:true,browserSandboxStatus:'container-isolated'
          } :
          path==='/api/cloud/usage' ? {dayTokens:0,dailyLimit:15000,monthTokens:0,monthlyLimit:100000} : {};
        return {ok:true,json:async()=>result};
      };
    });
    await page.addScriptTag({content:app});
    await page.addScriptTag({content:settings});
    await page.addScriptTag({content:remote});
    await page.waitForFunction(() => document.body.classList.contains('cloud-mode') &&
      document.querySelector('#stateLabel').textContent==='Basic browser commands ready');
    assert.equal(await page.locator('#runTask').isEnabled(),true);
    assert.equal(await page.locator('#openBrowser').isEnabled(),true);
    assert.match(await page.locator('#cloudBannerTitle').textContent(),/Basic browser commands are ready/);
    assert.match(await page.locator('#cloudBannerText').textContent(),/not an autonomous AI/);
    assert.match(await page.locator('#cloudUsage').textContent(),/no AI API fees/);
    assert.match(await page.locator('#ideas').textContent(),/Open https:/);
    await page.locator('#cloudBannerStatus').click();
    assert.match(await page.locator('#settingsMessage').textContent(),/Basic browser commands need no AI API/);
  } finally {
    await browser.close();
  }
});
