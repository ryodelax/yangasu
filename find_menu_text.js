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
  const result = await page.evaluate(() => {
    const texts = ['運用','③ 照合実行','照合実行','拡張機能'];
    const out = {};
    for (const text of texts) {
      out[text] = [...document.querySelectorAll('*')]
        .filter(el => (el.textContent||'').trim() === text)
        .map(el => ({tag: el.tagName, cls: el.className, role: el.getAttribute('role'), aria: el.getAttribute('aria-label'), x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)}))
        .slice(0,20);
    }
    return out;
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(err=>{console.error(err); process.exit(1)});
