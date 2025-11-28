
import puppeteer from 'puppeteer';

async function testScraping(url: string) {
    console.log(`Testing scraping for: ${url}`);
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set user agent to look like a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const content = await page.evaluate(() => document.body.innerText);
        console.log('Scraping successful!');
        console.log(`Content length: ${content.length} characters`);
        console.log('First 500 characters preview:');
        console.log(content.slice(0, 500));

        await browser.close();
    } catch (error) {
        console.error('Scraping failed:', error);
    }
}

// Test with the URL you mentioned
testScraping('https://www.lcmelo.com.br');
