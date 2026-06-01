import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleMsgs = [];
page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));

// Try both ports
let baseUrl = 'http://localhost:5173';
try {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 5000 });
} catch(e) {
  baseUrl = 'http://localhost:5174';
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 5000 });
}
console.log('Using base:', baseUrl);
await page.waitForTimeout(1500);

// Navigate to public datasets
await page.goto(`${baseUrl}/datasets/public`, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('nav err:', e.message));
await page.waitForTimeout(3000);

const publicInfo = await page.evaluate(() => ({
  url: location.href,
  paginationEl: document.querySelector('.mt-6')?.textContent?.trim()?.substring(0, 200) || 'NOT FOUND',
  hasDatasets: document.querySelectorAll('[class*="DatasetCard"], .dataset-card').length,
  bodySnippet: document.body.innerText.substring(0, 600),
}));
console.log('\n=== PUBLIC DATASETS ===');
console.log(JSON.stringify(publicInfo, null, 2));
await page.screenshot({ path: '/tmp/public_datasets.png', fullPage: true });

// Navigate to my datasets  
await page.goto(`${baseUrl}/datasets/my`, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.log('nav err:', e.message));
await page.waitForTimeout(3000);

const myInfo = await page.evaluate(() => ({
  url: location.href,
  paginationEl: document.querySelector('.mt-6')?.textContent?.trim()?.substring(0, 200) || 'NOT FOUND',
  bodySnippet: document.body.innerText.substring(0, 600),
}));
console.log('\n=== MY DATASETS ===');
console.log(JSON.stringify(myInfo, null, 2));
await page.screenshot({ path: '/tmp/my_datasets.png', fullPage: true });

console.log('\n=== CONSOLE ===');
consoleMsgs.slice(-20).forEach(m => console.log(m));

await browser.close();
