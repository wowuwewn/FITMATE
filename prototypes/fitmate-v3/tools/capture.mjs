import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const name of process.argv.slice(2).length?process.argv.slice(2):['home','explore']){
 await page.goto(`http://127.0.0.1:4178/#${name}`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(750);
 await page.screenshot({path:path.join(root,'qa',`${name}-390x844.png`)});
 console.log(JSON.stringify({screen:name,width:await page.evaluate(()=>document.documentElement.scrollWidth),errors}));
}
await browser.close();
