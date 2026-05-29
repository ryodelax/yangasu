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
  await page.mouse.click(470, 47);
  await delay(1200);
  const before = await browser.pages();
  await page.mouse.click(520, 145);
  await delay(12000);
  const pages = await browser.pages();
  console.log('pages', pages.length, 'before', before.length);
  for (const [i,p] of pages.entries()) {
    console.log('PAGE', i, p.url(), await p.title());
  }
  await page.screenshot({path:'/tmp/click_apps_script_item.png', fullPage:false});
  await browser.close();
})().catch(err=>{console.error(err); process.exit(1)});
