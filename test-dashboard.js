const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating to http://app.metabob.local...');
  await page.goto('http://app.metabob.local', { waitUntil: 'networkidle2' });
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const url = page.url();
  console.log('Current URL:', url);
  
  await browser.close();
  console.log('Done!');
})();
