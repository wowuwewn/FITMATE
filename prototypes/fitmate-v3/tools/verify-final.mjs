import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)), report=JSON.parse(await readFile(path.join(root,'qa/verification.json'),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=async route=>{await page.goto(`http://127.0.0.1:4178/${route}`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(750)};
const shot=async name=>{await page.waitForTimeout(750);await page.screenshot({path:path.join(root,'qa',name+'.png')})};
function pass(name){report.results.push({name,status:'passed'});console.log('PASS '+name)}
try{
 for(const route of ['home','cart']){await go(`#${route}`);await shot(`${route}-390x844`)}
 assert.match(await page.locator('.score-summary .text-button').textContent(),/점수 계산 방식/);
 await page.locator('[data-action="score-guide"]').click();await shot('score-guide-390x844');await page.keyboard.press('Escape');
 await go('#analysis');await page.locator('.relation-spotlight [data-action="evidence"]').click();await shot('evidence-sheet-390x844');assert.equal(await page.locator('dialog').evaluate(e=>getComputedStyle(e).opacity),'1');await page.keyboard.press('Escape');
 await page.locator('[data-action="question"][data-id="why"]').click();await shot('rules-explanation-390x844');
 await go('#home');await page.locator('.home-screen .tabs').scrollIntoViewIfNeeded();await shot('home-product-list-390x844');
 await go('design-system.html');await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#spec-number').textContent==='100');await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#spec-number').textContent==='88');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#replay').click();await page.waitForFunction(()=>document.querySelector('#spec-number').textContent==='100');await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.scrollTo(0,0));await shot('design-system-1440x900');
 pass('Design system: live engine gauge 88 ↔ 100, mobile layout, reduced motion');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await go('#home');
 const session=await context.newCDPSession(page);const startX=await page.evaluate(()=>window.scrollX);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:50,y:305}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>window.scrollX),startX);
 pass('Touch drag on home does not displace the page horizontally');
 await go('#analysis');await page.evaluate(()=>{document.querySelectorAll('#main p,#main h2,#main h3,#main button').forEach(e=>e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*2+'px')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('analysis-text-enlargement-390x844');
 pass('Analysis: simulated 200% text enlargement retains document width');
 const blocked=await browser.newContext({viewport:{width:390,height:844}});await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError')}});const b=await blocked.newPage();await b.goto('http://127.0.0.1:4178/#cart');await b.locator('[data-action="save"]').click();await b.locator('[data-form="save"] .primary-button').click();assert.equal(await b.locator('#save-error').isVisible(),true);assert.match(await b.locator('#save-error').textContent(),/저장하지 못했어요/);assert.equal(await b.locator('dialog').evaluate(d=>d.open),true);await b.screenshot({path:path.join(root,'qa/save-error-390x844.png')});await blocked.close();
 pass('Storage denial: visible in-sheet error, no false save success');
 assert.deepEqual(errors,[]);pass('Final visual states settled, no JavaScript errors');
 report.generated=new Date().toISOString();await writeFile(path.join(root,'qa/verification.json'),JSON.stringify(report,null,2));
}finally{await browser.close()}
