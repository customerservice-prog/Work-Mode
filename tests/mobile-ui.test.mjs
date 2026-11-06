import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

test('small phones and tablets can switch between chat and browser without horizontal overflow', {timeout:25000}, async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
    const script=await fs.readFile(new URL('../public/mobile.js',import.meta.url),'utf8');
    for (const viewport of [{width:390,height:844},{width:768,height:1024}]) {
      const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      await page.setContent(html,{waitUntil:'domcontentloaded'});
      await page.addScriptTag({content:script});
      await page.locator('body').evaluate(el=>el.classList.add('cloud-mode'));
      const nav=page.locator('#mobileNav');
      if(viewport.width<=1100){
        assert.notEqual(await nav.evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('#chatPanel').evaluate(el=>getComputedStyle(el).display),'none');
        assert.equal(await page.locator('#browserPanel').evaluate(el=>getComputedStyle(el).display),'none');
        await page.locator('[data-mobile-view=browser]').click();
        assert.notEqual(await page.locator('#browserPanel').evaluate(el=>getComputedStyle(el).display),'none');
        assert.equal(await page.locator('#chatPanel').evaluate(el=>getComputedStyle(el).display),'none');
      } else {
        assert.notEqual(await page.locator('#browserPanel').evaluate(el=>getComputedStyle(el).display),'none');
      }
      const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));
      assert.ok(metrics.scrollWidth<=metrics.innerWidth+2,JSON.stringify({viewport,metrics}));
      await page.close();
    }
  } finally {await browser.close();}
});

test('Home Screen manifest contains a standalone installable app',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.ok(manifest.icons.some(icon=>icon.purpose.includes('maskable')));
  const sw=await fs.readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.match(sw,/api\/|\/api\//);
  assert.doesNotMatch(sw,/caches\.open\(.*\/api\//);
});
