import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const phase=process.argv[2]||'after',root=path.resolve('docs/v4');
await mkdir(path.join(root,phase),{recursive:true});
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat()}
const protectedFiles=[...await walk('src/analysis'),...await walk('src/data'),'docs/PRD.md','docs/SCORING_POLICY.md'];
const hashes=Object.fromEntries(await Promise.all(protectedFiles.map(async f=>[f.replaceAll('\\','/'),createHash('sha256').update(await readFile(f)).digest('hex')])));
if(phase==='before')await writeFile(path.join(root,'protected-baseline.json'),JSON.stringify(hashes,null,2));
else{const baseline=JSON.parse(await readFile(path.join(root,'protected-baseline.json'),'utf8'));for(const[f,hash]of Object.entries(baseline))if(hash!==hashes[f])throw new Error(`Protected source changed: ${f}`)}
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
try{
 for(const [width,height]of [[320,568],[375,667],[390,844],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
  await context.addInitScript(()=>{localStorage.setItem('fitmate.intro.seen.v1','true');if(!localStorage.getItem('fitmate.cart.v1'))localStorage.setItem('fitmate.cart.v1',JSON.stringify([{productId:'P02',quantity:1},{productId:'M02',quantity:1}]))});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const screen of ['home','explore','cart','result','optimize','saved']){
   await page.goto(`http://127.0.0.1:5173/#${screen}`);await page.waitForSelector(`main>.${screen}-screen`);await page.evaluate(()=>document.fonts.ready);await page.locator('main img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));await page.waitForTimeout(750);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.app-shell').scrollWidth>document.querySelector('.app-shell').clientWidth);
   if(overflow)throw new Error(`${screen}: overflow at ${width}`);
   await page.screenshot({path:path.join(root,phase,`${screen}-${width}x${height}.png`)});
  }
  await context.close();console.log(`Captured ${phase}: ${width}×${height}`);
 }
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile(path.join(root,`${phase}-verification.json`),JSON.stringify({phase,protectedFiles:protectedFiles.length,protectedUnchanged:true,errors,viewports:[320,375,390,1440]},null,2));
}finally{await browser.close()}
