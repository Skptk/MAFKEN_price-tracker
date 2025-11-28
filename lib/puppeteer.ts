import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

let browserInstance: puppeteer.Browser | null = null;

/**
 * Get a Puppeteer browser instance configured for Vercel
 * Reuses the same browser instance across requests when possible
 */
export async function getBrowser(): Promise<puppeteer.Browser> {
    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }

    // Configure for Vercel deployment
    const isProduction = process.env.NODE_ENV === 'production';

    browserInstance = await puppeteer.launch({
        args: isProduction ? chromium.args : [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: isProduction
            ? await chromium.executablePath()
            : process.env.PUPPETEER_EXECUTABLE_PATH ||
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows default
        headless: chromium.headless,
    });

    return browserInstance;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
