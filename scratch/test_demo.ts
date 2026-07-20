import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Navigating to local server...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  console.log('Looking for "Continue as Guest"...');
  try {
    await page.waitForSelector('text="Continue as Guest"', { timeout: 3000 });
    await page.click('text="Continue as Guest"');
    console.log('Logged in as guest.');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('No guest login button found, maybe already logged in.');
  }

  console.log('Waiting for "Dengue (Approved)" button...');
  await page.waitForSelector('text="Dengue (Approved)"', { timeout: 10000 });
  await page.click('text="Dengue (Approved)"');

  console.log('Waiting for CaseWorkspace view...');
  await page.waitForTimeout(2000); // give it 2s to transition

  const text = await page.innerText('body');
  
  if (text.includes('Request Enhancement')) {
    console.log('SUCCESS: Request Enhancement button exists on the page.');
  } else {
    console.log('ERROR: "Request Enhancement" text not found. Body snippet:');
    console.log(text.substring(0, 1000));
  }
  
  console.log('Clicking "Diabetes Profile"...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  try {
    await page.waitForSelector('text="Continue as Guest"', { timeout: 1000 });
    await page.click('text="Continue as Guest"');
  } catch (e) {}

  await page.click('text="Diabetes Profile"');
  await page.waitForTimeout(2000);
  
  const diabetesText = await page.innerText('body');
  if (diabetesText.includes('Diabetes') || diabetesText.includes('Type 2')) {
      console.log('SUCCESS: Diabetes case loaded successfully.');
  } else {
      console.log('ERROR: Diabetes case failed to load.');
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
