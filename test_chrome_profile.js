const fs = require('fs');
const path = require('path');
const os = require('os');
const {execSync} = require('child_process');
const puppeteer = require('puppeteer-core');

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
    defaultViewport: {width: 1400, height: 900},
  });
  const page = await browser.newPage();
  await page.goto('https://docs.google.com/spreadsheets/d/1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU/edit#gid=1738009190', {waitUntil: 'domcontentloaded', timeout: 120000});
  await new Promise(r => setTimeout(r, 8000));
  const title = await page.title();
  const body = await page.evaluate(() => document.body.innerText.slice(0,500));
  console.log('TITLE:', title);
  console.log('BODY:', body.replace(/\n/g,' | '));
  await page.screenshot({path: `/tmp/${profileName.replace(/[^a-zA-Z0-9]/g,'_')}.png`, fullPage: false});
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
