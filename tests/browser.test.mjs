import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
test('Chromium renders, interacts, and captures screenshots', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.setContent('<!doctype html><title>Work-Mode test</title><input aria-label="Search"><button>Run task</button><div id="result"></div><script>document.querySelector("button").onclick=()=>document.querySelector("#result").textContent="Verified";</script>');
    await page.getByLabel('Search').fill('Google Voice');
    assert.equal(await page.getByLabel('Search').inputValue(), 'Google Voice');
    await page.getByRole('button', { name: 'Run task' }).click();
    assert.equal(await page.locator('#result').innerText(), 'Verified');
    assert.ok((await page.screenshot({ type: 'jpeg', quality: 55 })).length > 1000);
  } finally { await browser.close(); }
});
