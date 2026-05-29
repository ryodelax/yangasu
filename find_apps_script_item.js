const fs = require('fs');
const path = require('path');
const os = require('os');
const {execSync} = require('child_process');
const puppeteer = require('puppeteer-core');
async function delay(ms){return new Promise(r=>setTimeout(r,ms));}
(async () => {
  const profileName = 'Profile 1';
  const srcRoot = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  const dstRoot = `/tmp/chrome-copy-${profileName.replace(/[^a-zA-Z0-9]/g,'_')}`;
  execSync(`rm -rf ${JSON.stringify(dstRoot)}`);
  fs.mkdirSync(dstRoot, {recursive: true});
  for (const name of ['Local State', profileName]) execSync(`cp -R ${JSON.stringify(path.join(srcRoot,name))} ${JSON.stringify(path.join(dstRoot,name))}`);
  const browser = await puppeteer.launch({headless:false, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', userDataDir:dstRoot, args:[`--profile-directory=${profileName}`,'--no-first-run','--no-default-browser-check'], defaultViewport:{width:1440,height:960}});
  const page = await browser.newPage();
  await page.goto('https://docs.google.com/spreadsheets/d/1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M/edit#gid=700000200',{waitUntil:'domcontentloaded', timeout:120000});
  await delay(12000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div[role="menuitem"]')].find(el => (el.textContent||'').trim() === '拡張機能');
    if (!el) throw new Error('拡張機能 not found');
    el.click();
  });
  await delay(2000);
  const found = await page.evaluate(() => {
    return [...document.querySelectorAll('*')]
      .filter(el => /Apps Script/.test((el.textContent||'').trim()) && (el.offsetWidth || el.offsetHeight || el.getClientRects().length))
      .map(el => ({text:(el.textContent||'').trim(), tag:el.tagName, cls:el.className, role:el.getAttribute('role'), x:el.getBoundingClientRect().x, y:el.getBoundingClientRect().y, w:el.getBoundingClientRect().width, h:el.getBoundingClientRect().height}))
      .slice(0,20);
  });
  console.log(JSON.stringify(found,null,2));
  await browser.close();
})().catch(err=>{console.error(err); process.exit(1)});
