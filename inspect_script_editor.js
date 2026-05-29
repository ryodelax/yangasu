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
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: dstRoot,
    args: [`--profile-directory=${profileName}`, '--no-first-run', '--no-default-browser-check'],
    defaultViewport: {width: 1440, height: 1000},
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGELOG', msg.text()));
  await page.goto('https://script.google.com/u/0/home/projects/1mxQGp3A0BTyW1qpynSPYfleMkaBCF9lQa1Loj2lMqV9hPgC_OhR3WOt9/edit', {waitUntil:'networkidle2', timeout:120000});
  await new Promise(r => setTimeout(r, 5000));
  console.log('TITLE:', await page.title());
  const body = await page.evaluate(() => document.body.innerText.slice(0,3000));
  console.log('BODY:', body.replace(/\n/g,' | '));
  await page.screenshot({path:'/tmp/script-editor.png', fullPage:false});
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
