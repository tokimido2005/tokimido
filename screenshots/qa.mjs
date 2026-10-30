import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); });

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log('desktop overflow', overflow);
await page.screenshot({ path: '/workspace/screenshots/home-full.png', fullPage: true });

await page.goto('http://127.0.0.1:8080/jobs/1', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('job title', await page.locator('h1').innerText());
await page.screenshot({ path: '/workspace/screenshots/job.png', fullPage: false });

await page.goto('http://127.0.0.1:8080/post', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
console.log('post url', page.url());
await page.screenshot({ path: '/workspace/screenshots/post-redirect.png' });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const mOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log('mobile overflow', mOverflow, sw);
await page.screenshot({ path: '/workspace/screenshots/home-mobile.png' });
await page.evaluate(() => document.getElementById('joburi')?.scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: '/workspace/screenshots/jobs-mobile.png' });

await page.goto('http://127.0.0.1:8080/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/workspace/screenshots/login-mobile.png' });

await browser.close();
