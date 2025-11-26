import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const revalidate = 60;

// Rate limiting: Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { url, sku } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL required' },
        { status: 400 }
      );
    }

    // Rate limiting: Add 2-4 second delay before making request to be respectful to server
    await delay(2000 + Math.random() * 2000);

    let html = '';
    let finalUrl = url;

    // Try original URL first
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store'
      });

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
    } catch (urlError) {
      // If original URL fails and we have SKU, try SKU-based search
      if (sku) {
        console.log(`Original URL failed, trying SKU fallback for ${sku}`);

        // Carrefour Kenya search URL pattern
        const searchUrl = `https://www.carrefourkenya.com/mafken/en/search/?text=${encodeURIComponent(sku)}`;

        const searchResponse = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          cache: 'no-store'
        });

        if (!searchResponse.ok) {
          throw urlError; // Re-throw original error if SKU search also fails
        }

        html = await searchResponse.text();
        finalUrl = searchUrl;
      } else {
        throw urlError; // No SKU, can't fallback
      }
    }
    const $ = cheerio.load(html);

    let price = null;
    let originalPrice = null;
    let name = null;

    // 1. Try Visual Elements (Text Matches) first
    const bodyText = $('body').text();
    // Updated regex to handle comma-formatted prices like "29,999.00"
    const matches = [...bodyText.matchAll(/(.{0,20})KES\s*([\d,]+(?:\.\d{2})?)/g)];

    const potentialPrices: number[] = [];

    for (const match of matches) {
      const context = match[1].toLowerCase();
      const priceStr = match[2].replace(/,/g, ''); // Remove commas before parsing
      const val = parseFloat(priceStr);

      if (context.includes('save')) {
        continue; // Skip savings
      }

      potentialPrices.push(val);
    }

    if (potentialPrices.length > 0) {
      // The first valid price is usually the current price
      price = potentialPrices[0];

      // Look for a higher price which might be the original price
      const maxPrice = Math.max(...potentialPrices);
      if (maxPrice > price) {
        originalPrice = maxPrice;
      }
    }

    // 2. Fallback to JSON-LD
    if (!price) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonContent = $(el).html();
          if (!jsonContent) return;

          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'Product') {
            name = data.name || name;
            if (data.offers) {
              const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              if (offer) {
                const p = offer.price || offer.lowPrice || offer.highPrice;
                if (p) {
                  price = parseFloat(p);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      });
    }

    // 3. Fallback to Meta Tags
    if (!name) {
      name = $('meta[property="og:title"]').attr('content') ||
        $('title').text().split('|')[0].trim().replace('Buy ', '');
    }

    if (!price) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) {
        price = parseFloat(metaPrice);
      }
    }

    if (!price) {
      console.log('HTML Dump (truncated):', html.substring(0, 2000));
      return NextResponse.json(
        { success: false, error: 'Could not extract price from page' },
        { status: 400 }
      );
    }

    // Extract product image
    let imageUrl = null;

    // Try og:image meta tag first
    imageUrl = $('meta[property="og:image"]').attr('content');

    // Fallback to first product image
    if (!imageUrl) {
      const productImg = $('.product-image img, .product-img img, img[itemprop="image"]').first();
      imageUrl = productImg.attr('src') || productImg.attr('data-src');
    }

    return NextResponse.json({
      success: true,
      price,
      originalPrice,
      name: name || 'Product',
      imageUrl,
      sku,
      usedSkuFallback: finalUrl !== url,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape'
      },
      { status: 500 }
    );
  }
}
