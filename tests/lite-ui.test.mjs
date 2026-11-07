import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';

test('Lite desktop settings have no API-key setup and show memory diagnostics', {timeout:18000},async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
    const script=await fs.readFile(new URL('../public/settings.js',import.meta.url),'utf8');
    assert.ok(!html.includes('id="apiKey"'));
    assert.ok(!html.includes('value="openai"'));
    const page=await browser.newPage({viewport:{width:900,height:650}});
    await page.setContent(html);
    await page.evaluate(()=>{
      window.fetch=async url => {
        const status=String(url).includes('built-in/status');
        return {ok:true,json:async()=>status?{
          phase:'not-started',ready:false,
          hardware:{platform:'win32',architecture:'x64',totalMemoryGiB:4,availableMemoryGiB:1.2,enoughMemory:true}
        }:{}};
      };
    });
    await page.addScriptTag({content:script});
    assert.equal(await page.locator('#settingsDialog').evaluate(el=>el.open),false);
    await page.locator('#settingsButton').click();
    assert.equal(await page.locator('#settingsDialog').evaluate(el=>el.open),true);
    assert.match(await page.locator('#builtInInfo').textContent(),/4 GB installed/);
    assert.equal(await page.locator('#testOfflineAI').isVisible(),true);
    assert.equal(await page.locator('#copyDiagnostics').isVisible(),true);
    const close=await page.locator('#settingsClose').boundingBox();
    assert.ok(close&&close.y+close.height<=650);
    await page.locator('#settingsClose').click();
    assert.equal(await page.locator('#settingsDialog').evaluate(el=>el.open),false);
  }finally{await browser.close();}
});
