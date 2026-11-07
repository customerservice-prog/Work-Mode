import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

test('cloud app does not auto-open a nonfunctional API-key dialog; shows actual setup status on laptops and phones', {timeout:25000}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const html = await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
    const settings = await fs.readFile(new URL('../public/settings.js',import.meta.url),'utf8');
    const remote = await fs.readFile(new URL('../public/remote.js',import.meta.url),'utf8');
    for (const size of [{width:1366,height:768},{width:390,height:844}]) {
      const page = await browser.newPage({viewport:size});
      await page.setContent(html);
      await page.evaluate(() => {
        window.EventSource=class { constructor() {} };
        window.fetch = async (url) => {
          const pathname = String(url);
          const body = pathname === '/api/settings'
            ? {cloud:true,provider:'openai',openaiModel:'gpt-4.1-mini',hasApiKey:false}
            : pathname === '/api/mode'
              ? {cloud:true}
              : pathname === '/api/cloud/readiness'
                ? {aiConfigured:false,dataDirectoryConfigured:true,dataDirectoryWritable:true,volumeAttached:true,browserInstalled:true,browserSandboxStatus:'failed'}
                : pathname === '/api/cloud/usage'
                  ? {dayTokens:0,dailyLimit:15000,monthTokens:0,monthlyLimit:100000}
                  : {};
          return {ok:true,json:async()=>body};
        };
      });
      await page.addScriptTag({content:settings});
      await page.addScriptTag({content:remote});
      await page.waitForFunction(() =>
        document.body.classList.contains('cloud-mode') &&
        document.getElementById('cloudBannerText').textContent.includes('secure remote browser'));
      assert.equal(await page.locator('#settingsDialog').evaluate(x=>x.open),false,
        'Cloud UI must not automatically open the API-key dialog');
      assert.equal(await page.locator('#cloudSetupBanner').isVisible(),true);
      assert.equal(await page.locator('#runTask').isDisabled(),true);
      assert.equal(await page.locator('#openBrowser').isDisabled(),true);
      assert.match(await page.locator('#cloudBannerText').textContent(),/not connected/);
      await page.locator('#cloudBannerStatus').click();
      assert.equal(await page.locator('#settingsDialog').evaluate(x=>x.open),true);
      assert.equal(await page.locator('#settingsHeading').textContent(),'Cloud setup status');
      assert.equal(await page.locator('#apiKey').isVisible(),false,
        'Never solicit a cloud secret in the web form');
      assert.equal(await page.locator('#settingsSave').isVisible(),false);
      assert.match(await page.locator('#settingsMessage').textContent(),/OPENAI_API_KEY/);
      const rect=await page.locator('#settingsClose').boundingBox();
      assert.ok(rect && rect.y+rect.height<=size.height+1,
        'Close button must remain reachable without scrolling outside the dialog');
      await page.locator('#settingsClose').click();
      assert.equal(await page.locator('#settingsDialog').evaluate(x=>x.open),false);
      await page.close();
    }
  } finally { await browser.close(); }
});
