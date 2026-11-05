import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { analyzeCart, analysisDataset, getReplacementCandidates } from '../data/analysis.js';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=path.resolve(root,'../..');
const results=[],errors=[],failedRequests=[];
function passed(name,details={}){results.push({name,status:'passed',...details});console.log(`PASS ${name}`)}
const items=ids=>ids.map(productId=>({productId,quantity:1}));
const baseline=JSON.parse(await readFile(path.join(root,'qa/source-baseline.json'),'utf8'));
for(const [f,hash]of Object.entries(baseline))assert.equal(createHash('sha256').update(await readFile(path.join(repo,f))).digest('hex'),hash,`Source changed: ${f}`);
for(const f of ['cart_interactions_dataset.json','supplement_interactions_with_lactose_ko.json'])assert.equal(await readFile(path.join(root,'data',f),'utf8'),await readFile(path.join(repo,'src/data',f),'utf8'));
passed('Original app, engine, data and package files unchanged',{files:Object.keys(baseline).length});
assert.equal(analysisDataset.products.length,17);assert.equal(analysisDataset.rules.length,33);
const originals=JSON.parse(await readFile(path.join(root,'data/cart_interactions_dataset.json'),'utf8'));
for(const demo of originals.demo_carts)assert.deepEqual([...new Set(analyzeCart(items(demo.product_ids),analysisDataset).findings.map(f=>f.ruleId))].sort(),[...demo.expected_rule_ids].sort());
for(const [ids,value]of [[['P02','M02'],88],[['P03','M01'],75],[['P04','P05'],97],[['P08','P09'],97],[['P01','M01'],100],[[],null],[['P02'],null]])assert.equal(analyzeCart(items(ids),analysisDataset).score.value,value);
assert.equal(getReplacementCandidates(items(['P02','M02']),'M02',analysisDataset).length,0);
passed('Bundled engine: original matching examples, scores, null and medication guard');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedRequests.push(`${r.status()} ${r.url()}`)});
const go=async screen=>{await page.goto(`http://127.0.0.1:4178/#${screen}`);await page.reload();await page.evaluate(()=>document.fonts.ready);};
const click=async selector=>page.locator(selector).click();
const score=async expected=>{await page.waitForFunction(value=>document.querySelector('[data-score]')?.textContent===String(value),expected);};
const shoot=async name=>{await page.screenshot({path:path.join(root,'qa',name+'.png')});};
const seed=async ids=>{await page.evaluate(items=>localStorage.setItem('fitmate-v3-design-prototype',JSON.stringify({cart:items,saved:[]})),items(ids));};
try{
 await go('home');await click('[data-form="home-search"] input');await page.locator('[data-form="home-search"] input').fill('철');await page.locator('[data-form="home-search"]').press('Enter');await page.waitForURL('**/#explore');await page.waitForSelector('#catalog-results .product-row');assert.equal(await page.locator('#catalog-results .product-row').count(),2);
 await page.locator('#catalog-search').fill('없는제품');assert.equal(await page.locator('#catalog-results .product-row').count(),0);await click('.search-field [data-action="clear-search"]');await click('[data-action="mode"][data-id="medication"]');assert.equal(await page.locator('#catalog-results .product-row').count(),7);await click('[data-action="mode"][data-id="supplement"]');assert.equal(await page.locator('#catalog-results .product-row').count(),10);
 passed('Search, empty result, categories and medication separation');
 await go('cart');await score(88);await click('[data-action="quantity-plus"][data-id="P02"]');await score(88);assert.equal(await page.locator('[data-product="P02"] output').textContent(),'2');await click('[data-action="quantity-minus"][data-id="P02"]');await score(88);
 await click('[data-action="remove"][data-id="P02"]');await score('—');await click('[data-action="undo"]');await score(88);
 await go('explore');await click('[data-action="add"][data-id="P01"]');assert.match(await page.locator('#toast').textContent(),/담았어요/);await go('cart');await score(88);assert.equal(await page.locator('.cart-row').count(),3);await click('[data-action="remove"][data-id="P01"]');await score(88);
 passed('Add, delete, undo, quantity are container counts, score recalculation');
 await click('[data-action="save"]');await page.locator('#combination-name').fill('검수 조합');await click('[data-form="save"] .primary-button');await page.waitForFunction(()=>!document.querySelector('dialog').open);await go('saved');assert.match(await page.locator('.saved-row').textContent(),/검수 조합/);await go('cart');await click('[data-action="remove"][data-id="P02"]');await go('saved');await click('[data-action="restore"]');await page.waitForURL('**/#cart');await score(88);await page.reload();await score(88);
 passed('Named save, restore and reload persistence');
 await go('analysis');assert.match(await page.locator('.relation-svg').getAttribute('aria-label'),/R06/);assert.match(await page.locator('.relation-spotlight .deduction').textContent(),/12/);const evidence=page.locator('.relation-spotlight [data-action="evidence"]');await evidence.focus();await evidence.click();await page.waitForFunction(()=>document.querySelector('dialog').open);assert.equal(await page.locator('#sheet .source-list a').count(),2);assert.match(await page.locator('#sheet-body').textContent(),/データ|데이터셋 근거 수준/);await shoot('evidence-sheet-390x844');
 for(let i=0;i<10;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'evidence');assert.equal(await page.evaluate(()=>document.body.style.position),'');
 await click('[data-action="question"][data-id="why"]');assert.match(await page.locator('#explanation-answer').textContent(),/88점/);assert.match(await page.locator('#explanation-answer').textContent(),/AI 생성 아님/);await shoot('rules-explanation-390x844');await click('[data-action="question"][data-id="limits"]');assert.match(await page.locator('#explanation-answer').textContent(),/12개/);
 passed('Rule SVG, actual source links, native sheet focus trap / Escape / restoration, rule explanations');
 await go('optimize');assert.equal(await page.locator('#replacement-source').inputValue(),'P02');assert.equal(await page.locator('#replacement-target').inputValue(),'P01');assert.match(await page.locator('.comparison-delta').textContent(),/\+12/);await page.locator('#replacement-target').selectOption('P03');assert.match(await page.locator('.replacement-products').textContent(),/프로틴 C/);await page.locator('#replacement-target').selectOption('P01');await click('[data-action="apply-replacement"]');await page.waitForURL('**/#cart');await score(100);assert.equal(await page.locator('[data-product="M02"]').count(),1);assert.equal(await page.locator('[data-product="P01"]').count(),1);await shoot('replacement-applied-390x844');
 passed('Replacement: 88 → 100 (+12), actual cause removal, medication retained');
 await go('home');await click('[data-action="example"][data-id="duplicate"]');await click('[data-action="apply-example"]');await page.waitForURL('**/#cart');await score(97);await go('analysis');assert.match(await page.locator('.relation-svg').getAttribute('aria-label'),/R09/);assert.match(await page.locator('.duplicate-row').textContent(),/비타민 D/);await click('[data-action="question"][data-id="duplicate"]');assert.match(await page.locator('#explanation-answer').textContent(),/비타민 D/);
 await seed(['P01','P02']);await go('analysis');assert.equal(await page.locator('.relation-svg').count(),0);assert.match(await page.locator('.duplicate-row').textContent(),/등록된 감점 규칙 없음/);
 await seed(['P02','M02','P07','P08']);await go('analysis');assert.equal(await page.locator('[data-action="relation"]').count(),3);await click('[data-action="relation"][data-id="R13"]');assert.match(await page.locator('.relation-svg').getAttribute('aria-label'),/R13/);
 await seed([]);await go('cart');await score('—');assert.equal(await page.locator('[data-action="save"]').count(),0);await go('optimize');assert.match(await page.locator('#main').textContent(),/후보가 없어요/);
 passed('Example apply, duplicate R09, ruleless duplicate, multi-cause selection, empty states');
 for(const [width,height]of [[320,568],[390,844],[430,932],[1440,900]]){
  await page.setViewportSize({width,height});await seed(['P02','M02']);
  for(const screen of ['home','explore','cart','analysis','optimize','saved']){await go(screen);await page.waitForTimeout(700);const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),font:document.fonts.check('16px Pretendard')}));assert.ok(layout.document<=width,`${screen} overflows at ${width}`);assert.ok(layout.images,`${screen} image failed`);assert.ok(layout.font);await shoot(`${screen}-${width}x${height}`);}
  await go('cart');await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(70);const clearance=await page.evaluate(()=>{const b=document.querySelector('[data-action="quantity-plus"][data-id="M02"]').getBoundingClientRect();return {target:b.bottom,dock:document.querySelector('.action-dock').getBoundingClientRect().top};});assert.ok(clearance.target<=clearance.dock,`Last control hidden at ${width}`);
  passed(`Responsive ${width}×${height}: six routes, fonts, assets, no overflow, bottom controls accessible`);
 }
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await go('cart');await score(88);assert.equal(await page.locator('.screen').evaluate(e=>getComputedStyle(e).animationName),'none');await go('analysis');assert.equal(await page.locator('.relation-edge').evaluate(e=>getComputedStyle(e).animationName),'none');await go('optimize');await page.waitForFunction(()=>document.querySelector('[data-compare]').textContent==='100점');
 passed('Reduced motion: ring, numbers, relation SVG, comparison settle immediately');
 await page.evaluate(()=>localStorage.setItem('fitmate-v3-design-prototype','{broken'));await go('cart');await score(88);passed('Corrupt stored JSON recovers to labelled DEMO');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);passed('No browser runtime errors or failed local requests');
}catch(error){results.push({name:'Browser verification',status:'failed',error:error.stack});await shoot('failure');throw error;}
finally{await writeFile(path.join(root,'qa/verification.json'),JSON.stringify({generated:new Date().toISOString(),browser:'Chrome / Playwright',results,errors,failedRequests,limitations:['Real iOS Safari, Android hardware, assistive technology and live clinical source review were not tested.','AI API is intentionally not called.']},null,2));await browser.close();}
