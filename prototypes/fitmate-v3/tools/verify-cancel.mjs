import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4178/#explore');await page.locator('[data-action="cancel-add"][data-id="P02"]').click();assert.equal(await page.locator('[data-action="add"][data-id="P02"]').count(),1);assert.match(await page.locator('#toast').textContent(),/취소/);await page.locator('[data-action="undo"]').click();assert.equal(await page.locator('[data-action="cancel-add"][data-id="P02"]').count(),1);
 await page.locator('[data-action="add"][data-id="P01"]').click();assert.equal(await page.locator('[data-action="cancel-add"][data-id="P01"]').count(),1);await page.locator('[data-action="cancel-add"][data-id="P01"]').click();assert.equal(await page.locator('[data-action="add"][data-id="P01"]').count(),1);
 await page.locator('[data-action="product"][data-id="P02"]').click();assert.equal(await page.locator('[data-action="sheet-cancel"]').count(),1);assert.equal(await page.getByRole('button',{name:'닫고 돌아가기',exact:true}).count(),1);await page.locator('[data-action="sheet-cancel"]').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.locator('[data-action="add"][data-id="P02"]').count(),1);
 await page.locator('[data-action="product"][data-id="P01"]').click();await page.getByRole('button',{name:'닫고 돌아가기',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'P01');
 await page.goto('http://127.0.0.1:4178/#home');await page.locator('.home-screen [data-action="category"][data-id="전체"]').last().scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>window.scrollY);await page.locator('.home-screen [data-action="category"][data-id="전체"]').last().click();await page.waitForURL('**/#explore');await page.locator('.topbar .back').click();await page.waitForURL('**/#home');assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-scroll)<3);
 await page.locator('.nav-item[href="#cart"]').click();await page.locator('[data-action="go"][data-id="explore"]').click();await page.waitForURL('**/#explore');await page.locator('.topbar .back').click();await page.waitForURL('**/#cart');
 await page.locator('[data-action="go"][data-id="explore"]').click();await page.waitForURL('**/#explore');await page.locator('[data-action="add"][data-id="P02"]').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(root,'qa/explore-cancel-390x844.png')});
 await page.locator('[data-action="product"][data-id="P02"]').click();await page.waitForTimeout(400);await page.screenshot({path:path.join(root,'qa/product-cancel-sheet-390x844.png')});await page.keyboard.press('Escape');
 await page.setViewportSize({width:320,height:568});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 const report=JSON.parse(await readFile(path.join(root,'qa/verification.json'),'utf8'));report.results.push({name:'Explore cancellation: visible cancel toggle, undo, sheet cancel / return, contextual back to home/cart with scroll restoration, 320px width',status:'passed'});await writeFile(path.join(root,'qa/verification.json'),JSON.stringify(report,null,2));
 console.log('PASS add/cancel toggle, undo, product sheet cancel/return, contextual back and scroll restoration, 320px');
}finally{await browser.close()}
