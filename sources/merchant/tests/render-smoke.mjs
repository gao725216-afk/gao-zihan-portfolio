import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:18827/';
const label=process.argv[3]||'local';
const output=new URL('../research-20261029/',import.meta.url);
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,chromiumSandbox:true});
const report={base,label,at:new Date().toISOString(),scope:'页面渲染与资源冒烟检查；不代表完整交互验收',checks:[],errors:[]};
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({device,error:e.message}));page.on('response',r=>{if(r.status()>=400)report.errors.push({device,url:r.url(),status:r.status()})});
  const response=await page.goto(base+'#/products',{waitUntil:'networkidle',timeout:45000});
  await page.getByRole('heading',{name:'商品库',exact:true}).waitFor({timeout:15000});
  const goods=await page.locator(device==='desktop'?'.catalog-desktop-table .t-table__body tr':'.catalog-mobile-product').count();
  const images=await page.locator('.catalog-thumb').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  await page.screenshot({path:new URL(`${label}-products-${device}.png`,output).pathname.replace(/^\/(\w:)/,'$1'),fullPage:device==='desktop'});
  report.checks.push({device,route:'products',http:response.status(),goods,imagesLoaded:images,wholePageOverflow:overflow});
  await page.goto(base+'#/inventory',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'库存中心',exact:true}).waitFor();
  report.checks.push({device,route:'inventory',visible:true});
  if(device==='desktop')await page.screenshot({path:new URL(`${label}-inventory-${device}.png`,output).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  await context.close();
 }
}finally{await browser.close();fs.writeFileSync(new URL(`${label}-render-smoke.json`,output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(report.errors.length||report.checks.some(c=>c.http&&c.http!==200||c.imagesLoaded===false||c.wholePageOverflow))process.exitCode=1;
