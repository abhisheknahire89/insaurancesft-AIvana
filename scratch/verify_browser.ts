import { chromium } from 'playwright';

async function main() {
  console.log('--- Quick Browser Verification Check ---');
  let browserVerifyPassed = false;
  let browserErrorMessage = 'None';
  
  try {
    console.log('Launching headless chromium via Playwright...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { timeout: 15000 });
    
    // If we are in demo mode, click the return link to go to normal sandbox mode
    const returnBtn = page.locator('button:has-text("Return to normal sandbox")');
    const returnBtnFull = page.locator('button:has-text("Return to normal sandbox mode")');
    if (await returnBtn.isVisible()) {
      console.log('Detected presentation sandbox. Toggling to normal sandbox mode...');
      await returnBtn.click();
      await page.waitForTimeout(500);
    } else if (await returnBtnFull.isVisible()) {
      console.log('Detected presentation sandbox. Toggling to normal sandbox mode...');
      await returnBtnFull.click();
      await page.waitForTimeout(500);
    }
    
    const newPreauthBtn = page.locator('button:has-text("New Pre-Authorization"), button:has-text("＋ New Pre-Authorization"), button:has-text("+ New Pre-Authorization"), button:has-text("Run Fairway AI Pre-Auth Audit")');
    const isVisible = await newPreauthBtn.isVisible();
    console.log(`"New Pre-Authorization" button visible? ${isVisible}`);
    
    if (isVisible) {
      browserVerifyPassed = true;
      console.log('✅ Browser check passed: Main UI successfully loaded without process.cwd() or bundler errors.');
    } else {
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`[Troubleshooting] DOM Text:\n${bodyText}`);
      throw new Error('New Pre-Authorization button not found in page DOM');
    }
    
    await browser.close();
  } catch (e: any) {
    console.error('❌ Browser check failed:', e.message);
    browserErrorMessage = e.message;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
