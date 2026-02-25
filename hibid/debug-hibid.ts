import puppeteer from 'puppeteer';

const URL = 'https://www.hibid.com/lots?search=air%20fryer';

async function debugPage() {
  console.log('Launching browser...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log(`Navigating to ${URL}...`);
  
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('Waiting for lots to load...');
    await page.waitForSelector('a[href*="/lot/"]', { timeout: 15000 }).catch(() => console.log('Timeout waiting for lot links'));
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n=== All class names on lot-related elements ===\n');
    
    // Get all unique class names that contain "lot"
    const classNames = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const classes = new Set<string>();
      
      for (const el of Array.from(elements)) {
        if (el.className && typeof el.className === 'string') {
          if (el.className.toLowerCase().includes('lot')) {
            classes.add(el.className);
          }
        }
      }
      
      return Array.from(classes).slice(0, 30);
    });
    
    console.log('Class names containing "lot":');
    classNames.forEach((c: string) => console.log(`  - ${c}`));
    
    // Get lot list container classes
    console.log('\n=== Lot list container ===\n');
    const lotListContainer = await page.$('#lot-list');
    if (lotListContainer) {
      const classes = await page.evaluate((el: Element) => el.className, lotListContainer);
      console.log(`#lot-list classes: ${classes}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugPage();
