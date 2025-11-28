import { NextRequest, NextResponse } from 'next/server';
import { getBrowser } from '@/lib/puppeteer';

export const runtime = 'nodejs';
export const revalidate = 86400; // 24 hours
export const maxDuration = 30; // 30 seconds max for Puppeteer

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
    let browser;
    try {
        // Rate limiting: 2-4 second delay
        await delay(2000 + Math.random() * 2000);

        const urls = [
            'https://www.carrefour.ke/mafken/en/c/ken-dod-offers',
            'https://www.carrefour.ke/mafken/en/c/ken-online-exclusives',
            'https://www.carrefour.ke/mafken/en/c/ken-flash-sale'
        ];

        const offers: Array<{
            name: string;
            price: number;
            originalPrice?: number;
            imageUrl?: string;
            url: string;
            sku?: string;
            discount?: string;
        }> = [];

        // Get browser instance
        browser = await getBrowser();

        // Scrape all URLs sequentially (to avoid overwhelming the server)
        for (const url of urls) {
            try {
                const page = await browser.newPage();

                // Set realistic viewport
                await page.setViewport({ width: 1920, height: 1080 });

                // Set user agent to look like a real browser
                await page.setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                );

                // Set extra headers
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                });

                // Disable automation flags
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => false,
                    });
                });

                await page.setDefaultTimeout(20000);

                console.log(`[${new URL(url).pathname}] Navigating...`);

                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 20000
                });

                await delay(2000);

                await Promise.race([
                    page.waitForSelector('a[href*="/p/"]', { timeout: 5000 }),
                    delay(5000)
                ]).catch(() => { });

                // Extract product data - USE VERY CONSERVATIVE APPROACH
                const pageOffers = await page.evaluate(() => {
                    const products: any[] = [];
                    const productLinks = document.querySelectorAll('a[href*="/p/"]');

                    productLinks.forEach((link) => {
                        try {
                            // CRITICAL: Find container that has ONLY this one product link
                            let container = link.parentElement;
                            let depth = 0;

                            while (container && depth < 6) {
                                const linksInContainer = container.querySelectorAll('a[href*="/p/"]');

                                // Perfect container = exactly 1 product link
                                if (linksInContainer.length === 1) {
                                    break;
                                }

                                container = container.parentElement;
                                depth++;
                            }

                            // Fallback to immediate parent if no isolated container found
                            if (!container || depth >= 6) {
                                container = link.parentElement || link;
                            }

                            const url = (link as HTMLAnchorElement).href;
                            if (!url || products.some(p => p.url === url)) return;

                            // Name: prefer link text
                            let name = link.textContent?.trim().replace(/\s+/g, ' ') || '';
                            if (name.includes('KES')) {
                                // Link has price in it, try to clean
                                name = name.split('KES')[0].trim();
                            }

                            if (!name || name.length < 3) return;

                            // Image: ONLY from this isolated container
                            let imageUrl = '';
                            if (container) {
                                const imgs = container.querySelectorAll('img');
                                for (const img of Array.from(imgs)) {
                                    const src = img.src || img.getAttribute('data-src') || '';
                                    if (src && !src.startsWith('data:') && !src.includes('placeholder')) {
                                        imageUrl = src;
                                        break;
                                    }
                                }
                            }

                            // Price: scan container text
                            let price: number | null = null;
                            let originalPrice: number | null = null;
                            let discount: string | undefined = undefined;

                            const containerText = container?.textContent || '';

                            // Try to find all price-like patterns
                            const priceMatches = Array.from(containerText.matchAll(/KES\s*([\d,]+(?:\.\d{2})?)/gi));

                            if (priceMatches.length > 0) {
                                // Extract all numbers found
                                const prices = priceMatches.map(m => parseFloat(m[1].replace(/,/g, '')));

                                // Usually the smaller one is the current price, larger is original
                                if (prices.length >= 2) {
                                    const sortedPrices = [...prices].sort((a, b) => a - b);
                                    price = sortedPrices[0]; // Lowest price is current
                                    originalPrice = sortedPrices[sortedPrices.length - 1]; // Highest is original

                                    // Sanity check: if they are the same, no discount
                                    if (price === originalPrice) originalPrice = null;
                                } else {
                                    price = prices[0];
                                }
                            }

                            // Look for discount percentage (e.g. -20%, 20% OFF)
                            const discountMatch = containerText.match(/(\d+)%\s*(?:OFF|discount|-)/i) || containerText.match(/-(\d+)%/);
                            if (discountMatch) {
                                discount = `-${discountMatch[1]}%`;
                            } else if (price && originalPrice) {
                                // Calculate discount if we have both prices but no badge
                                const percent = Math.round(((originalPrice - price) / originalPrice) * 100);
                                if (percent > 0) discount = `-${percent}%`;
                            }

                            if (!price || price < 1 || price > 1000000) return;

                            // SKU
                            const skuMatch = url.match(/\/(\d+)$/);
                            const sku = skuMatch ? skuMatch[1] : undefined;

                            products.push({
                                name: name.substring(0, 200),
                                price,
                                originalPrice: originalPrice || undefined,
                                imageUrl,
                                url,
                                sku,
                                discount
                            });
                        } catch (err) {
                            // Skip
                        }
                    });

                    return products;
                });

                offers.push(...pageOffers);
                await page.close();

                console.log(`[${new URL(url).pathname}] Found ${pageOffers.length} offers`);

            } catch (err) {
                console.error(`Error scraping ${url}:`, err);
            }
        }

        if (offers.length === 0) {
            return NextResponse.json({
                success: true,
                offers: [],
                message: 'No offers found on promotion pages'
            });
        }

        console.log(`Total offers: ${offers.length}`);

        return NextResponse.json({
            success: true,
            offers: offers.slice(0, 30),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Discover offers error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch offers'
            },
            { status: 500 }
        );
    }
}
