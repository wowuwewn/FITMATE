import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile,copyFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const isolated=path.join(root,'qa','.standalone-check.html');
await copyFile(path.join(root,'OPEN-FITMATE.html'),isolated);
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
try{
 await page.goto(pathToFileURL(isolated).href);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('h1').textContent(),'나의 영양 루틴,조합부터 살펴봐요.');assert.ok(await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)));
 await page.locator('.nav-item[href="#cart"]').click();await page.waitForFunction(()=>document.querySelector('[data-score]').textContent==='88');
 await page.locator('.attention-row').click();await page.locator('[data-action="go"][data-id="optimize"]').click();await page.locator('[data-action="apply-replacement"]').click();await page.waitForFunction(()=>document.querySelector('[data-score]').textContent==='100');
 await page.locator('[data-action="save"]').click();await page.locator('#combination-name').fill('단일 HTML 검수');await page.locator('[data-form="save"] button').click();await page.locator('.nav-item[href="#saved"]').click();assert.match(await page.locator('.saved-row').textContent(),/단일 HTML 검수/);
 await page.goto(pathToFileURL(path.join(root,'DESIGN-SYSTEM.html')).href);await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#spec-number').textContent==='100');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const report=JSON.parse(await readFile(path.join(root,'qa/verification.json'),'utf8'));const name='Single HTML file://: app and design system, embedded assets, 88 → 100 comparison, save, zero HTTP requests';report.results=report.results.filter(r=>!r.name.startsWith('Single HTML file://'));report.results.push({name,status:'passed'});await writeFile(path.join(root,'qa/verification.json'),JSON.stringify(report,null,2));
 console.log('PASS standalone file:// HTML, embedded assets, real comparison, local saving, zero HTTP requests');
}finally{await browser.close();await unlink(isolated)}
