const fs = require('fs');
const path = require('path');
const os = require('os');
const {execSync} = require('child_process');
const puppeteer = require('puppeteer-core');

async function delay(ms){return new Promise(r=>setTimeout(r,ms));}

async function main() {
  const profileName = process.argv[2] || 'Profile 1';
  const srcRoot = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  const dstRoot = `/tmp/chrome-copy-${profileName.replace(/[^a-zA-Z0-9]/g,'_')}`;
  execSync(`rm -rf ${JSON.stringify(dstRoot)}`);
  fs.mkdirSync(dstRoot, {recursive: true});
  for (const name of ['Local State', profileName]) {
    const src = path.join(srcRoot, name);
    const dst = path.join(dstRoot, name);
    execSync(`cp -R ${JSON.stringify(src)} ${JSON.stringify(dst)}`);
  }
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: dstRoot,
    args: [`--profile-directory=${profileName}`, '--no-first-run', '--no-default-browser-check'],
    defaultViewport: {width: 1440, height: 960},
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.goto('https://docs.google.com/spreadsheets/d/1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M/edit#gid=700000200', {waitUntil: 'domcontentloaded'});
  await delay(15000);

  async function clickText(text) {
    const xpath = `//*[normalize-space(text())=${JSON.stringify(text)}]`;
    const handles = await page.$x(xpath);
    if (!handles.length) throw new Error(`text not found: ${text}`);
    await handles[0].click();
  }

  const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log('BODY_START', bodyStart.replace(/\n/g,' | '));

  await clickText('運用');
  await delay(2000);
  await clickText('③ 照合実行');
  console.log('clicked menu item');
  await delay(10000);
  let status = '';
  for (let i = 0; i < 36; i++) {
    status = await page.evaluate(() => document.body.innerText);
    const snippet = status.slice(0, 3000).replace(/\n/g,' | ');
    console.log('POLL', i, snippet);
    if (/完了|更新済み|キャッシュフロー|CF反映/.test(status) && !/実行しています/.test(status)) break;
    await delay(10000);
  }
  await page.screenshot({path: '/tmp/run_main_menu_result.png', fullPage: false});
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
